// Vercel catch-all serverless entry point for every /api/* request.
// The shared Express app contains auth, admin, CV/AI, and upload endpoints.
import { app } from "../server";

export default app;
