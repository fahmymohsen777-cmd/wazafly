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

// ─── AI Providers Abstraction ──────────────────────────────────────────────────
export interface AIProvider {
  generateContent(options: {
    contents: any;
    model?: string;
    responseMimeType?: string;
    responseSchema?: any;
    temperature?: number;
  }): Promise<{ text: string }>;
}

export class GeminiProvider implements AIProvider {
  private ai: any;

  constructor() {
    const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    let apiKey = rawKey?.replace(/^[\"']|[\"']$/g, "");
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") apiKey = undefined;
    this.ai = new GoogleGenAI(apiKey ? { apiKey } : {});
  }

  async generateContent(options: {
    contents: any;
    model?: string;
    responseMimeType?: string;
    responseSchema?: any;
    temperature?: number;
  }): Promise<{ text: string }> {
    const model = options.model || "gemini-2.5-flash";
    const config: any = {};
    if (options.responseMimeType) config.responseMimeType = options.responseMimeType;
    if (options.responseSchema) config.responseSchema = options.responseSchema;
    if (options.temperature !== undefined) config.temperature = options.temperature;

    const response = await this.ai.models.generateContent({
      model,
      contents: options.contents,
      config,
    });
    return { text: response.text || "" };
  }
}

export class DahlProvider implements AIProvider {
  private apiKey: string;
  private defaultModel = "moonshotai/Kimi-K2.6";

  constructor() {
    this.apiKey = (process.env.DAHL_API_KEY || "").replace(/^[\"']|[\"']$/g, "").trim();
  }

  async generateContent(options: {
    contents: any;
    model?: string;
    responseMimeType?: string;
    responseSchema?: any;
    temperature?: number;
  }): Promise<{ text: string }> {
    if (!this.apiKey) {
      throw new Error("Dahl API key is missing. Please set DAHL_API_KEY in your environment.");
    }

    // Convert contents to chat messages
    let messages: any[] = [];
    if (typeof options.contents === "string") {
      messages = [{ role: "user", content: options.contents }];
    } else if (Array.isArray(options.contents)) {
      messages = options.contents.map((item: any) => {
        if (typeof item === "string") {
          return { role: "user", content: item };
        }
        const role = item.role === "model" ? "assistant" : "user";
        let content = "";
        if (Array.isArray(item.parts)) {
          content = item.parts.map((p: any) => p.text || "").join("\n");
        } else if (typeof item.content === "string") {
          content = item.content;
        }
        return { role, content };
      });
    } else if (options.contents && typeof options.contents === "object") {
      const role = options.contents.role === "model" ? "assistant" : "user";
      let content = "";
      if (Array.isArray(options.contents.parts)) {
        content = options.contents.parts.map((p: any) => p.text || "").join("\n");
      } else if (typeof options.contents.content === "string") {
        content = options.contents.content;
      }
      messages = [{ role, content }];
    }

    const requestBody: any = {
      model: this.defaultModel,
      messages: messages,
    };

    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    if (options.responseMimeType === "application/json") {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch("https://inference.dahl.global/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Dahl API error (HTTP ${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return { text };
  }
}

const geminiProvider = new GeminiProvider();
const dahlProvider = new DahlProvider();

export function getActiveProviderName(req?: Request): string {
  if (req?.body?.provider === "dahl" || req?.body?.provider === "gemini") {
    return req.body.provider;
  }
  const envProvider = process.env.AI_PROVIDER?.toLowerCase().trim();
  if (envProvider === "dahl") return "dahl";
  return "gemini";
}

export function getProvider(name: string): AIProvider {
  if (name === "dahl") return dahlProvider;
  return geminiProvider;
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

  // CORS — allow localhost in dev and Railway domain in production
  const allowedOrigin = process.env.APP_URL || "http://localhost:3001";
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return cb(null, true);
      if (origin.endsWith(".railway.app")) return cb(null, true);
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

        const providerName = getActiveProviderName(req);
        try {
          const provider = getProvider(providerName);
          const response = await provider.generateContent({
            model: "gemini-2.5-flash",
            contents: `Convert this HR search query into JSON filters for a candidate database.\nQuery: "${query}"`,
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
        const providerName = getActiveProviderName(req);
        const isInvalidKey = err.message?.includes("API key not valid") || err.message?.includes("API_KEY_INVALID") || err.message?.includes("Dahl API key");
        res.status(status).json({
          error: isInvalidKey
            ? `مفتاح ${providerName === 'dahl' ? 'Dahl' : 'Gemini'} غير صحيح — تحقق من إعدادات السيرفر.`
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

        const providerName = getActiveProviderName(req);
        try {
          const provider = getProvider(providerName);
          const response = await provider.generateContent({
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
        const providerName = getActiveProviderName(req);
        const isInvalidKey = err.message?.includes("API key not valid") || err.message?.includes("API_KEY_INVALID") || err.message?.includes("Dahl API key");
        res.status(status).json({
          error: isInvalidKey
            ? `مفتاح ${providerName === 'dahl' ? 'Dahl' : 'Gemini'} غير صحيح.`
            : err.message || "فشل في إنشاء السيرة الذاتية.",
        });
      }
    }
  );

  // ─── AI Proxy Route (HR only) - Replaces client-side Gemini calls ──────────
  app.post(
    "/api/ai/proxy",
    requireAuth,
    requireRole("hr", "admin"),
    rateLimit,
    async (req: Request, res: Response) => {
      try {
        const params = req.body;
        if (!params || !params.model || !params.contents) {
          return res.status(400).json({ error: "معلمات غير صالحة." });
        }

        const providerName = getActiveProviderName(req);
        if (providerName === "gemini") {
          const ALLOWED_MODELS = ["gemini-2.5-flash"];
          if (!ALLOWED_MODELS.includes(params.model)) {
            return res.status(400).json({ error: "model غير مسموح" });
          }
        }
        if (JSON.stringify(params.contents).length > 5_000_000) {
          return res.status(400).json({ error: "الطلب أكبر من المسموح (الحد الأقصى 5MB)" });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000);

        try {
          const provider = getProvider(providerName);
          const response = await provider.generateContent({
            model: params.model,
            contents: params.contents,
            responseMimeType: params.config?.responseMimeType,
            responseSchema: params.config?.responseSchema,
            temperature: params.config?.temperature,
          });
          clearTimeout(timeout);
          res.json({ text: response.text });
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name === "AbortError") {
            return res.status(504).json({ error: "انتهت مهلة الطلب — حاول مرة أخرى." });
          }
          throw err;
        }
      } catch (err: any) {
        const status = err.status || 500;
        const providerName = getActiveProviderName(req);
        const isInvalidKey = err.message?.includes("API key not valid") || err.message?.includes("API_KEY_INVALID") || err.message?.includes("Dahl API key");
        res.status(status).json({
          error: isInvalidKey
            ? `مفتاح ${providerName === 'dahl' ? 'Dahl' : 'Gemini'} غير صحيح.`
            : err.message || "فشل في معالجة طلب الذكاء الاصطناعي.",
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

        const providerName = getActiveProviderName(req);
        try {
          const provider = getProvider(providerName);
          const response = await provider.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an expert technical recruiter. Score candidates based on the query.
HR Search Query: "${query}"
Candidates: ${JSON.stringify(candidatesToScore, null, 2)}
Return a JSON array: [{"id": "...", "score": 0-100, "reason": "one sentence"}]`,
            responseMimeType: "application/json",
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
