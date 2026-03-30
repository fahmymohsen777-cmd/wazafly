import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import Stripe from "stripe";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize Stripe (optional for MVP, using mock if no key)
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

  // API routes
  console.log("STARTUP GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "SET" : "UNSET", process.env.GEMINI_API_KEY?.substring(0, 5) + "...");
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Search Route
  app.post("/api/ai/search", async (req, res) => {
    try {
      const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      let apiKey = rawKey?.replace(/^["']|["']$/g, '');
      if (apiKey === "MY_GEMINI_API_KEY") apiKey = undefined;
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
      const { query } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Convert this HR search query into JSON filters for a candidate database.
        Query: "${query}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of skills mentioned in the query"
              },
              city: {
                type: Type.STRING,
                description: "City or location mentioned in the query"
              },
              minExperience: {
                type: Type.NUMBER,
                description: "Minimum years of experience mentioned"
              },
              jobTitle: {
                type: Type.STRING,
                description: "Job title or role mentioned"
              },
              maxSalary: {
                type: Type.NUMBER,
                description: "Maximum salary expectation mentioned"
              }
            }
          }
        }
      });

      let filters = {};
      if (response.text) {
        try {
          filters = JSON.parse(response.text);
        } catch (e) {
          console.error("JSON Parse Error:", e);
        }
      }
      
      res.json(filters);
    } catch (error: any) {
      console.error("AI Search Error:", error);
      const isInvalidKey = error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID");
      res.status(500).json({ 
        error: isInvalidKey ? "Invalid Gemini API Key. If you added GEMINI_API_KEY to your Secrets, please ensure it is correct, or remove it to use the default platform key." : `Failed to process search query: ${error.message}`, 
        details: error.message 
      });
    }
  });

  // AI CV Builder Route
  app.post("/api/ai/cv-builder", async (req, res) => {
    try {
      const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      let apiKey = rawKey?.replace(/^["']|["']$/g, '');
      if (apiKey === "MY_GEMINI_API_KEY") apiKey = undefined;
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
      const { name, experience, skills, education, projects } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate a professional CV in Markdown format based on the following details:
        Name: ${name}
        Experience: ${experience}
        Skills: ${skills}
        Education: ${education}
        Projects: ${projects}
        
        Make it well-structured, professional, and ready to be exported as a PDF.`,
      });

      res.json({ cvMarkdown: response.text });
    } catch (error: any) {
      console.error("AI CV Builder Error:", error);
      const isInvalidKey = error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID");
      res.status(500).json({ 
        error: isInvalidKey ? "Invalid Gemini API Key. If you added GEMINI_API_KEY to your Secrets, please ensure it is correct, or remove it to use the default platform key." : `Failed to generate CV: ${error.message}`, 
        details: error.message 
      });
    }
  });

  // AI Candidate Ranking Route
  app.post("/api/ai/rank", async (req, res) => {
    try {
      const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      let apiKey = rawKey?.replace(/^["']|["']$/g, '');
      if (apiKey === "MY_GEMINI_API_KEY") apiKey = undefined;
      const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
      const { query, candidates } = req.body;
      
      if (!candidates || candidates.length === 0) {
        return res.json({ rankings: [] });
      }

      // Prepare a simplified list of candidates for the AI to score
      const candidatesToScore = candidates.map((c: any) => ({
        id: c.id,
        job_title: c.job_title,
        skills: c.skills,
        experience_years: c.experience_years,
        city: c.city
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an expert technical recruiter. Score the following candidates based on how well they match the HR search query.
        
        HR Search Query: "${query}"
        
        Candidates:
        ${JSON.stringify(candidatesToScore, null, 2)}
        
        Return ONLY a JSON array of objects, where each object has:
        - "id": the candidate id
        - "score": an integer from 0 to 100 representing the match percentage
        - "reason": a short 1-sentence explanation for the score
        
        Example: [{"id": "123", "score": 85, "reason": "Strong React skills and matches experience requirement."}]`,
        config: {
          responseMimeType: "application/json",
        }
      });

      const rankings = JSON.parse(response.text || "[]");
      res.json({ rankings });
    } catch (error: any) {
      console.error("AI Ranking Error:", error);
      const isInvalidKey = error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID");
      res.status(500).json({ 
        error: isInvalidKey ? "Invalid Gemini API Key. If you added GEMINI_API_KEY to your Secrets, please ensure it is correct, or remove it to use the default platform key." : `Failed to rank candidates: ${error.message}`, 
        details: error.message 
      });
    }
  });

  // Stripe Checkout Route
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    if (!stripe) {
      // Mock success redirect for MVP testing if Stripe is not configured
      console.log("Stripe not configured, mocking success redirect...");
      return res.json({ url: `${process.env.APP_URL}/dashboard?session_id=mock_session_123` });
    }
    
    try {
      const { priceId, userId } = req.body;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${process.env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/pricing`,
        client_reference_id: userId,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on http://localhost:" + PORT);
  });
}

startServer();
