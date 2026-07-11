// Vercel serverless entry point.
//
// Root cause fix: previously the Express app in server.ts was only ever
// created *inside* an async startServer() function and was never exported.
// There was no `/api` folder and no Vercel "functions"/"builds" config, so
// Vercel had nothing to invoke for any `/api/*` request in production — it
// just returned its own default 404 HTML page ("The page could not be
// found"). That is exactly why the admin dashboard's fetch to
// `/api/admin/users` failed with "Unexpected token 'T', \"The page c\"...
// is not valid JSON": the browser received Vercel's HTML 404 page instead of
// the JSON the app expected, since the API route was never actually
// deployed anywhere.
//
// This file, combined with the `[...path]` catch-all filename, tells Vercel
// to run the shared Express app (all its routes, auth, and admin endpoints)
// as a serverless function for every request under `/api/*`.
import { app } from "../server";

export default app;
