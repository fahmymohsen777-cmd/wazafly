import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import Stripe from "stripe";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// ─── Supabase Admin (Server-side ONLY — never expose to client) ──────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "https://ndjoxbcedhajbiaihpeo.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// ─── Gemini helper ────────────────────────────────────────────────────────────
function getAI() {
  const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  let apiKey = rawKey?.replace(/^[\"']|[\"']$/g, "");
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") apiKey = undefined;
  return new GoogleGenAI(apiKey ? { apiKey } : {});
}

// ─── Simple in-memory rate limiter ───────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  if (entry.count >= RATE_LIMIT) {
    return res.status(429).json({ error: "حاول مرة أخرى بعد دقيقة — تجاوزت الحد المسموح به." });
  }

  entry.count++;
  return next();
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "غير مصرح — يرجى تسجيل الدخول أولاً." });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "جلسة منتهية الصلاحية — يرجى تسجيل الدخول مجدداً." });
  }

  (req as any).user = user;
  next();
}

function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "غير مصرح." });

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !roles.includes(profile.role)) {
      return res.status(403).json({ error: "ليس لديك صلاحية للوصول إلى هذه الخدمة." });
    }

    (req as any).profile = profile;
    next();
  };
}

// ─── Safe JSON parse from Gemini ─────────────────────────────────────────────
function safeParseGeminiJson(text: string | undefined, fallback: any = {}): any {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences if present
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return fallback;
    }
  }
}

// ─── Input validation helper ──────────────────────────────────────────────────
function validateString(val: unknown, name: string, maxLen = 2000): string {
  if (typeof val !== "string" || val.trim().length === 0) {
    throw Object.assign(new Error(`الحقل "${name}" مطلوب.`), { status: 400 });
  }
  if (val.length > maxLen) {
    throw Object.assign(new Error(`الحقل "${name}" يتجاوز الحد المسموح (${maxLen} حرف).`), { status: 400 });
  }
  return val.trim();
}

// ─── Main Server ──────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3001', 10);

  // CORS — only allow our own domain
  const allowedOrigin = process.env.APP_URL || "http://localhost:3001";
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return cb(null, true);
      if (origin === allowedOrigin) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }));

  // Raw body for Stripe webhook (must come before express.json)
  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

  // JSON body with error handling
  app.use((req, res, next) => {
    if (req.path === "/api/stripe/webhook") return next();
    express.json({ limit: "20mb" })(req, res, (err) => {
      if (err) return res.status(400).json({ error: "طلب غير صحيح — يرجى إرسال JSON صحيح." });
      next();
    });
  });

  // ─── Initialize Stripe ──────────────────────────────────────────────────────
  const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

  // ─── Health check ───────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // ─── AI Search Route (HR only) ──────────────────────────────────────────────
  app.post(
    "/api/ai/search",
    requireAuth,
    requireRole("hr", "admin"),
    rateLimit,
    async (req: Request, res: Response) => {
      try {
        const query = validateString(req.body?.query, "query", 500);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25_000);

        try {
          const ai = getAI();
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Convert this HR search query into JSON filters for a candidate database.\nQuery: "${query}"`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of skills" },
                  city: { type: Type.STRING, description: "City or location" },
                  minExperience: { type: Type.NUMBER, description: "Minimum years of experience" },
                  jobTitle: { type: Type.STRING, description: "Job title" },
                  maxSalary: { type: Type.NUMBER, description: "Maximum salary" },
                },
              },
            },
          });
          clearTimeout(timeout);
          res.json(safeParseGeminiJson(response.text, {}));
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name === "AbortError") {
            return res.status(504).json({ error: "انتهت مهلة الطلب — حاول مرة أخرى." });
          }
          throw err;
        }
      } catch (err: any) {
        const status = err.status || 500;
        const isInvalidKey = err.message?.includes("API key not valid") || err.message?.includes("API_KEY_INVALID");
        res.status(status).json({
          error: isInvalidKey
            ? "مفتاح Gemini غير صحيح — تحقق من إعدادات السيرفر."
            : err.message || "فشل في معالجة البحث.",
        });
      }
    }
  );

  // ─── AI CV Builder Route (Job Seekers only) ──────────────────────────────────
  app.post(
    "/api/ai/cv-builder",
    requireAuth,
    requireRole("job_seeker"),
    rateLimit,
    async (req: Request, res: Response) => {
      try {
        const name = validateString(req.body?.name, "name", 100);
        const experience = validateString(req.body?.experience, "experience", 2000);
        const skills = validateString(req.body?.skills, "skills", 500);
        const education = validateString(req.body?.education, "education", 1000);
        const projects = req.body?.projects ? String(req.body.projects).slice(0, 2000) : "";

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        try {
          const ai = getAI();
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a professional CV in Markdown format:
Name: ${name}
Experience: ${experience}
Skills: ${skills}
Education: ${education}
Projects: ${projects}

Make it well-structured, professional, and ready to export as PDF.`,
          });
          clearTimeout(timeout);
          res.json({ cvMarkdown: response.text });
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name === "AbortError") {
            return res.status(504).json({ error: "انتهت مهلة توليد السيرة الذاتية — حاول مرة أخرى." });
          }
          throw err;
        }
      } catch (err: any) {
        const status = err.status || 500;
        const isInvalidKey = err.message?.includes("API key not valid") || err.message?.includes("API_KEY_INVALID");
        res.status(status).json({
          error: isInvalidKey
            ? "مفتاح Gemini غير صحيح."
            : err.message || "فشل في إنشاء السيرة الذاتية.",
        });
      }
    }
  );

  // ─── AI Proxy Route — dynamic provider from DB (HR/admin only) ──────────────
  app.post(
    "/api/ai/proxy",
    requireAuth,
    requireRole("hr", "admin", "job_seeker"),
    rateLimit,
    async (req: Request, res: Response) => {
      try {
        const params = req.body;
        if (!params || !params.contents) {
          return res.status(400).json({ error: "معلمات غير صالحة — contents مطلوب." });
        }
        if (JSON.stringify(params.contents).length > 20000) {
          return res.status(400).json({ error: "الطلب أكبر من المسموح (20,000 حرف)." });
        }

        // ── Load active provider from DB ────────────────────────────────────────
        const { data: providerRow, error: provErr } = await supabaseAdmin
          .from("ai_providers")
          .select("name, base_url, model, api_key")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000);

        try {
          let responseText: string;

          if (!provErr && providerRow && providerRow.base_url && providerRow.api_key) {
            // ── OpenAI-compatible provider (e.g. dahl.global, Kimi K2, etc.) ─
            const model = params.model || providerRow.model;
            const baseUrl = providerRow.base_url.replace(/\/$/, "");

            // Normalise contents → OpenAI messages format
            let messages: { role: string; content: string }[];
            if (Array.isArray(params.contents)) {
              messages = params.contents.map((c: any) => ({
                role: c.role === "model" ? "assistant" : (c.role || "user"),
                content: typeof c.parts?.[0]?.text === "string"
                  ? c.parts[0].text
                  : (typeof c === "string" ? c : JSON.stringify(c)),
              }));
            } else {
              messages = [{ role: "user", content: String(params.contents) }];
            }

            const fetchRes = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              signal: controller.signal,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${providerRow.api_key}`,
              },
              body: JSON.stringify({
                model,
                messages,
                ...(params.config?.maxOutputTokens ? { max_tokens: params.config.maxOutputTokens } : {}),
              }),
            });

            if (!fetchRes.ok) {
              const errBody = await fetchRes.text();
              throw new Error(`[${providerRow.name}] HTTP ${fetchRes.status}: ${errBody.slice(0, 200)}`);
            }

            const data = await fetchRes.json();
            responseText = data.choices?.[0]?.message?.content ?? "";
          } else {
            // ── Fallback: Gemini SDK ────────────────────────────────────────────
            const ai = getAI();
            const response = await ai.models.generateContent(params);
            responseText = response.text ?? "";
          }

          clearTimeout(timeout);
          res.json({ text: responseText });
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name === "AbortError") {
            return res.status(504).json({ error: "انتهت مهلة الطلب — حاول مرة أخرى." });
          }
          throw err;
        }
      } catch (err: any) {
        const status = err.status || 500;
        res.status(status).json({
          error: err.message || "فشل في معالجة طلب الذكاء الاصطناعي.",
        });
      }
    }
  );

  // ─── AI Candidate Ranking Route (HR only) ────────────────────────────────────
  app.post(
    "/api/ai/rank",
    requireAuth,
    requireRole("hr", "admin"),
    rateLimit,
    async (req: Request, res: Response) => {
      try {
        const query = validateString(req.body?.query, "query", 500);
        const candidates = req.body?.candidates;

        if (!Array.isArray(candidates)) {
          return res.status(400).json({ error: "الحقل 'candidates' يجب أن يكون مصفوفة." });
        }
        if (candidates.length === 0) return res.json({ rankings: [] });
        if (candidates.length > 100) {
          return res.status(400).json({ error: "الحد الأقصى 100 مرشح في الطلب الواحد." });
        }

        const candidatesToScore = candidates.map((c: any) => ({
          id: c.id,
          job_title: c.job_title,
          skills: c.skills,
          experience_years: c.experience_years,
          city: c.city,
        }));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        try {
          const ai = getAI();
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an expert technical recruiter. Score candidates based on the query.
HR Search Query: "${query}"
Candidates: ${JSON.stringify(candidatesToScore, null, 2)}
Return a JSON array: [{"id": "...", "score": 0-100, "reason": "one sentence"}]`,
            config: { responseMimeType: "application/json" },
          });
          clearTimeout(timeout);
          const rankings = safeParseGeminiJson(response.text, []);
          res.json({ rankings: Array.isArray(rankings) ? rankings : [] });
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name === "AbortError") {
            return res.status(504).json({ error: "انتهت مهلة ترتيب المرشحين — حاول مرة أخرى." });
          }
          throw err;
        }
      } catch (err: any) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message || "فشل في ترتيب المرشحين." });
      }
    }
  );

  // ─── Stripe Checkout (HR only) ────────────────────────────────────────────
  app.post(
    "/api/stripe/create-checkout-session",
    requireAuth,
    requireRole("hr", "admin"),
    async (req: Request, res: Response) => {
      if (!stripe) {
        return res.status(503).json({ error: "نظام الدفع غير مفعّل حالياً." });
      }

      try {
        const priceId = validateString(req.body?.priceId, "priceId", 100);
        const userId = (req as any).user.id;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [{ price: priceId, quantity: 1 }],
          mode: "subscription",
          success_url: `${process.env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.APP_URL}/pricing`,
          client_reference_id: userId,
          idempotency_key: `checkout-${userId}-${priceId}-${Date.now()}`,
        } as any);

        res.json({ url: session.url });
      } catch (err: any) {
        res.status(500).json({ error: "فشل إنشاء جلسة الدفع ��� حاول مرة أخرى." });
      }
    }
  );

  // ─── Stripe Webhook ───────────────────────────────────────────────────────
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    if (!stripe) return res.status(400).json({ error: "Stripe not configured." });

    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: "Missing stripe-signature header or webhook secret." });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          // Determine plan from subscription metadata/amount
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id || "unknown";

          await supabaseAdmin.from("subscriptions").upsert({
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            plan: priceId,
            status: "active",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        }
      }

      if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by stripe customer id
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub) {
          await supabaseAdmin.from("subscriptions").update({
            status: subscription.status === "active" ? "active" : "inactive",
            updated_at: new Date().toISOString(),
          }).eq("user_id", sub.user_id);
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("[Stripe webhook error]", err?.message || err);
      res.status(500).json({ received: false });
    }
  });

  // ─── Admin API — list users (replaces client-side supabaseAdmin.auth.admin.listUsers) ──
  app.get(
    "/api/admin/users",
    requireAuth,
    requireRole("admin"),
    async (_req: Request, res: Response) => {
      try {
        // Get auth users (requires service role key)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) return res.status(500).json({ error: authError.message });

        // Get public users with profiles and subscriptions
        const { data: publicUsers, error: pubError } = await supabaseAdmin
          .from("users")
          .select("*, profiles(name, phone), subscriptions(status, plan)");
        if (pubError) return res.status(500).json({ error: pubError.message });

        // Sync missing auth users into public.users
        for (const authUser of authData.users) {
          const exists = publicUsers?.find((u: any) => u.id === authUser.id);
          if (!exists) {
            await supabaseAdmin.from("users").insert([{
              id: authUser.id,
              email: authUser.email,
              role: authUser.user_metadata?.role || "job_seeker",
            }]);
            await supabaseAdmin.from("profiles").insert([{
              user_id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.name || "Unknown User",
            }]);
          }
        }

        // Re-fetch after sync
        const { data: finalUsers, error: finalError } = await supabaseAdmin
          .from("users")
          .select("*, profiles(name, phone), subscriptions(status, plan)");
        if (finalError) return res.status(500).json({ error: finalError.message });

        res.json(finalUsers || []);
      } catch (err: any) {
        res.status(500).json({ error: err.message || "فشل في جلب المستخدمين." });
      }
    }
  );

  // ─── Admin API — delete user (auth + public) ──────────────────────────────
  app.delete(
    "/api/admin/users/:id",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const userId = req.params.id;
        if (!userId || typeof userId !== "string") {
          return res.status(400).json({ error: "معرّف المستخدم غير صحيح." });
        }

        // Delete from auth.users (cascades to public.users via FK if set up)
        const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authDelError) {
          // Fallback: delete from public.users only if auth deletion fails
          console.warn("[admin/users DELETE] auth.admin.deleteUser failed:", authDelError.message);
        }

        // Always delete from public.users to ensure cleanup
        const { error: pubDelError } = await supabaseAdmin.from("users").delete().eq("id", userId);
        if (pubDelError) return res.status(500).json({ error: pubDelError.message });

        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "فشل في حذف المستخدم." });
      }
    }
  );

  // ─── Admin API — fetch payments (used by AdminDashboardPage) ──────────────
  app.get(
    "/api/admin/payments",
    requireAuth,
    requireRole("admin"),
    async (_req: Request, res: Response) => {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("*, users(email, profiles(name))")
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    }
  );

  // ─── Admin API — update payment status ───────────────────────────────────
  app.patch(
    "/api/admin/payments/:id",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const paymentId = req.params.id;
        const status = ["approved", "rejected", "pending"].includes(req.body?.status)
          ? req.body.status
          : null;
        if (!status) return res.status(400).json({ error: "حالة غير صالحة." });

        const { error } = await supabaseAdmin
          .from("payments")
          .update({ status })
          .eq("id", paymentId);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "فشل تحديث الدفعة." });
      }
    }
  );

  // ─── Admin API — toggle HR role ────────────────────────────────────────────
  app.patch(
    "/api/admin/users/:id/hr-role",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const userId = req.params.id;
        const hrRole = ["admin_hr", "recruiter"].includes(req.body?.hr_role)
          ? req.body.hr_role
          : null;
        if (!hrRole) return res.status(400).json({ error: "hr_role غير صالح." });

        const { error } = await supabaseAdmin
          .from("users")
          .update({ hr_role: hrRole })
          .eq("id", userId);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "فشل تحديث صلاحية HR." });
      }
    }
  );

  // ─── Admin API — update subscription ─────────────────────────────────────
  app.patch(
    "/api/admin/users/:id/subscription",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const userId = req.params.id;
        const plan = validateString(req.body?.plan, "plan", 50);
        const status = ["active", "inactive", "cancelled"].includes(req.body?.status)
          ? req.body.status
          : "active";
        const startDate = new Date().toISOString();
        const endDate = req.body?.end_date || null;

        // Check if subscription exists
        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (existingSub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status, plan, start_date: startDate, end_date: endDate, updated_at: new Date().toISOString() })
            .eq("id", existingSub.id);
        } else {
          await supabaseAdmin
            .from("subscriptions")
            .insert([{ user_id: userId, status, plan, start_date: startDate, end_date: endDate }]);
        }

        res.json({ ok: true });
      } catch (err: any) {
        const s = err.status || 500;
        res.status(s).json({ error: err.message || "فشل تحديث الاشتراك." });
      }
    }
  );

  // ─── Admin API proxy — subscriptions (used by AdminDashboardPage) ─────────
  app.get(
    "/api/admin/subscriptions",
    requireAuth,
    requireRole("admin"),
    async (_req: Request, res: Response) => {
      const { data, error } = await supabaseAdmin.from("subscriptions").select("*");
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    }
  );

  app.post(
    "/api/admin/subscriptions",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const userId = validateString(req.body?.user_id, "user_id");
        const plan = validateString(req.body?.plan, "plan");
        const status = ["active", "inactive", "cancelled"].includes(req.body?.status)
          ? req.body.status
          : "inactive";

        const { error } = await supabaseAdmin.from("subscriptions").upsert(
          { user_id: userId, plan, status, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true });
      } catch (err: any) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message || "فشل في تحديث الاشتراك." });
      }
    }
  );

  // ─── Admin API — AI Providers CRUD ───────────────────────────────────────
  // GET: list providers (api_key NEVER returned to client)
  app.get(
    "/api/admin/ai-providers",
    requireAuth,
    requireRole("admin"),
    async (_req: Request, res: Response) => {
      const { data, error } = await supabaseAdmin
        .from("ai_providers")
        .select("id, name, base_url, model, is_active, created_at")
        .order("created_at", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    }
  );

  // POST: create provider
  app.post(
    "/api/admin/ai-providers",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const name = validateString(req.body?.name, "name", 100);
        const base_url = validateString(req.body?.base_url, "base_url", 500);
        const model = validateString(req.body?.model, "model", 200);
        const api_key = validateString(req.body?.api_key, "api_key", 500);
        const is_active = req.body?.is_active === true || req.body?.is_active === "true";

        // If setting as active, deactivate all others first
        if (is_active) {
          await supabaseAdmin.from("ai_providers").update({ is_active: false }).neq("id", 0);
        }

        const { data, error } = await supabaseAdmin
          .from("ai_providers")
          .insert([{ name, base_url, model, api_key, is_active }])
          .select("id, name, base_url, model, is_active, created_at")
          .single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
      } catch (err: any) {
        res.status(err.status || 500).json({ error: err.message });
      }
    }
  );

  // PATCH: update provider (can update any field including api_key)
  app.patch(
    "/api/admin/ai-providers/:id",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "id غير صالح." });

        const updates: Record<string, any> = {};
        if (req.body?.name !== undefined) updates.name = validateString(req.body.name, "name", 100);
        if (req.body?.base_url !== undefined) updates.base_url = validateString(req.body.base_url, "base_url", 500);
        if (req.body?.model !== undefined) updates.model = validateString(req.body.model, "model", 200);
        if (req.body?.api_key !== undefined && req.body.api_key !== "") {
          updates.api_key = validateString(req.body.api_key, "api_key", 500);
        }
        if (req.body?.is_active !== undefined) {
          updates.is_active = req.body.is_active === true || req.body.is_active === "true";
          // Deactivate all others before activating this one
          if (updates.is_active) {
            await supabaseAdmin.from("ai_providers").update({ is_active: false }).neq("id", id);
          }
        }

        updates.updated_at = new Date().toISOString();

        const { error } = await supabaseAdmin.from("ai_providers").update(updates).eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true });
      } catch (err: any) {
        res.status(err.status || 500).json({ error: err.message });
      }
    }
  );

  // DELETE: remove provider
  app.delete(
    "/api/admin/ai-providers/:id",
    requireAuth,
    requireRole("admin"),
    async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "id غير صالح." });
      const { error } = await supabaseAdmin.from("ai_providers").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ ok: true });
    }
  );

  // ─── Upload Links — HR Management (authenticated) ────────────────────────────
  // GET all links for current HR user
  app.get(
    "/api/hr/upload-links",
    requireAuth,
    requireRole("hr", "admin"),
    async (req: Request, res: Response) => {
      const userId = (req as any).userId;
      const { data, error } = await supabaseAdmin
        .from("upload_links")
        .select("id, token, label, expires_at, max_uses, use_count, is_locked, created_at")
        .eq("hr_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    }
  );

  // POST create a new upload link
  app.post(
    "/api/hr/upload-links",
    requireAuth,
    requireRole("hr", "admin"),
    async (req: Request, res: Response) => {
      const userId = (req as any).userId;
      const label = req.body?.label ? validateString(req.body.label, "label", 200) : null;
      const maxUses = Number(req.body?.max_uses) || 100;
      const expiryDays = Number(req.body?.expiry_days) || 30;
      const expiresAt = new Date(Date.now() + expiryDays * 86400_000).toISOString();

      const { data, error } = await supabaseAdmin
        .from("upload_links")
        .insert([{ hr_user_id: userId, label, max_uses: maxUses, expires_at: expiresAt }])
        .select("id, token, label, expires_at, max_uses, use_count, is_locked, created_at")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json(data);
    }
  );

  // PATCH lock/unlock a link
  app.patch(
    "/api/hr/upload-links/:id",
    requireAuth,
    requireRole("hr", "admin"),
    async (req: Request, res: Response) => {
      const userId = (req as any).userId;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "id غير صالح." });
      const updates: any = {};
      if (req.body?.is_locked !== undefined) updates.is_locked = Boolean(req.body.is_locked);
      if (req.body?.max_uses !== undefined) updates.max_uses = Number(req.body.max_uses);
      if (req.body?.label !== undefined) updates.label = req.body.label ? validateString(req.body.label, "label", 200) : null;
      const { error } = await supabaseAdmin.from("upload_links").update(updates).eq("id", id).eq("hr_user_id", userId);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ ok: true });
    }
  );

  // DELETE a link
  app.delete(
    "/api/hr/upload-links/:id",
    requireAuth,
    requireRole("hr", "admin"),
    async (req: Request, res: Response) => {
      const userId = (req as any).userId;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "id غير صالح." });
      const { error } = await supabaseAdmin.from("upload_links").delete().eq("id", id).eq("hr_user_id", userId);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ ok: true });
    }
  );

  // ─── Public Upload Link: GET info (no auth, validate token) ──────────────────
  // Per-token rate limit map (separate from authenticated rate limit)
  const publicUploadRateMap = new Map<string, { count: number; resetAt: number }>();

  function publicUploadRateLimit(req: Request, res: Response, next: NextFunction) {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const token = req.params.token || "";
    const key = `${ip}:${token}`;
    const now = Date.now();
    const entry = publicUploadRateMap.get(key);
    if (entry && now < entry.resetAt) {
      if (entry.count >= 5) {
        return res.status(429).json({ error: "تجاوزت الحد المسموح — انتظر دقيقة ثم حاول مجدداً." });
      }
      entry.count++;
    } else {
      publicUploadRateMap.set(key, { count: 1, resetAt: now + 60_000 });
    }
    next();
  }

  app.get(
    "/api/upload-links/:token",
    publicUploadRateLimit,
    async (req: Request, res: Response) => {
      const { token } = req.params;
      const { data, error } = await supabaseAdmin
        .from("upload_links")
        .select("id, label, expires_at, max_uses, use_count, is_locked")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) return res.status(404).json({ error: "الرابط غير موجود." });
      if (data.is_locked) return res.status(403).json({ error: "هذا الرابط مغلق من قِبل صاحبه." });
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية هذا الرابط." });
      }
      if (data.max_uses && data.use_count >= data.max_uses) {
        return res.status(410).json({ error: "تجاوز الرابط الحد الأقصى لعدد الاستخدامات." });
      }

      res.json({ label: data.label, max_uses: data.max_uses, use_count: data.use_count, expires_at: data.expires_at });
    }
  );

  // ─── Public Upload Link: POST upload (multipart/form-data, no auth) ──────────
  // Uses multer in-memory (max 10MB) — validates type + size before Supabase upload
  app.post(
    "/api/upload-links/:token/upload",
    publicUploadRateLimit,
    express.raw({ type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "multipart/form-data"], limit: "11mb" }),
    async (req: Request, res: Response) => {
      const { token } = req.params;

      // Re-validate token
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("upload_links")
        .select("id, hr_user_id, is_locked, expires_at, max_uses, use_count")
        .eq("token", token)
        .maybeSingle();

      if (linkErr || !link) return res.status(404).json({ error: "الرابط غير موجود." });
      if (link.is_locked) return res.status(403).json({ error: "هذا الرابط مغلق." });
      if (link.expires_at && new Date(link.expires_at) < new Date()) return res.status(410).json({ error: "انتهت صلاحية الرابط." });
      if (link.max_uses && link.use_count >= link.max_uses) return res.status(410).json({ error: "تجاوز الرابط الحد الأقصى." });

      // Parse multipart manually with busboy for security
      const busboy = (await import("busboy")).default({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 /* 10MB */ } });
      let fileBuffer: Buffer | null = null;
      let fileName = "upload";
      let mimeType = "";
      let fileTooLarge = false;

      busboy.on("file", (_field: string, file: any, info: any) => {
        fileName = info.filename || "upload";
        mimeType = info.mimeType || "";
        const chunks: Buffer[] = [];
        file.on("data", (d: Buffer) => chunks.push(d));
        file.on("limit", () => { fileTooLarge = true; file.resume(); });
        file.on("end", () => { if (!fileTooLarge) fileBuffer = Buffer.concat(chunks); });
      });

      busboy.on("finish", async () => {
        if (fileTooLarge) return res.status(413).json({ error: "حجم الملف يتجاوز الحد الأقصى (10 MB)." });
        if (!fileBuffer) return res.status(400).json({ error: "لم يتم إرسال ملف." });

        // Strict MIME + extension validation
        const allowedMimes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];
        const allowedExts = [".pdf", ".doc", ".docx"];
        const ext = "." + (fileName.split(".").pop() || "").toLowerCase();

        if (!allowedMimes.includes(mimeType) || !allowedExts.includes(ext)) {
          return res.status(400).json({ error: "نوع الملف غير مدعوم. يُقبل فقط PDF أو Word." });
        }

        // Upload to Supabase storage under upload-links/{token}/{timestamp}_{filename}
        const safeFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const storagePath = `upload-links/${token}/${safeFileName}`;

        const { error: uploadErr } = await supabaseAdmin.storage
          .from("cv-bank")
          .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

        if (uploadErr) return res.status(500).json({ error: "فشل رفع الملف: " + uploadErr.message });

        // Increment use_count atomically
        await supabaseAdmin.rpc("increment_upload_link_use_count", { link_id: link.id });

        res.json({ ok: true, path: storagePath });
      });

      req.pipe(busboy);
    }
  );

  // ─── 404 for unknown API routes ───────────────────────────────────────────
  app.use("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "المسار غير موجود." });
  });

  // ─── Vite or static files ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (_req, res) => res.sendFile("dist/index.html", { root: "." }));
  }

  // ─── Global Error Middleware ──────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Server Error]", err?.message || err);
    res.status(err?.status || 500).json({ error: "حدث خطأ داخلي في السيرفر." });
  });

  // ─── Process-level safety nets ────────────────────────────────────────────
  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
