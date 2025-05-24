import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { companySearchRouter } from "./routes/companySearch.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * MatchMeToJobs API Server
 *
 * Main features:
 * 1. Company search with financial/size filters (via Allabolag scraping)
 * 2. Industry matching (converts descriptions like "software development" to Swedish codes)
 * 3. AI-powered company enrichment (web search + extraction)
 *
 * Environment variables required:
 * - ANTHROPIC_API_KEY: For AI industry matching and company enrichment
 * - BRAVE_API_KEY: For web search during company enrichment
 * - PORT: Server port (default: 4000)
 *
 * Main endpoint:
 * POST /api/companies/search - Find and enrich companies based on criteria
 *
 * Health check:
 * GET /api/companies/health - Verify all services are configured
 */
const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());
app.use("*", prettyJSON());

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: err.message,
        details: err.cause || null,
      },
      err.status
    );
  }

  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: "Internal server error",
    },
    500
  );
});

// Routes
app.route("/api/companies", companySearchRouter);

// Root endpoint with API documentation
app.get("/", (c) => {
  return c.json({
    name: "MatchMeToJobs API",
    version: "1.0.0",
    description: "Find and match job opportunities with company data",
    endpoints: {
      "POST /api/companies/search": {
        description: "Search and enrich companies based on criteria",
        required: ["description"],
        optional: [
          "location",
          "industryDescription", // NEW: Auto-matches to Swedish industry codes
          "revenueFrom/To",
          "profitFrom/To",
          "numEmployeesFrom/To",
          "sort",
        ],
        example: {
          description: "Looking for software development companies",
          location: "Stockholm",
          industryDescription: "software development", // Matches to industry codes
          revenueFrom: 1000000,
        },
      },
      "GET /api/companies/health": {
        description: "Health check and service status",
        response: "Service configuration status",
      },
    },
    features: {
      company_search: "Search Swedish companies via Allabolag",
      industry_matching:
        "AI-powered industry code matching (645 Swedish codes)",
      company_enrichment: "Web search + AI extraction for company details",
      smart_filtering: "Financial, size, and location-based filtering",
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Not found",
      message: "The requested endpoint does not exist",
    },
    404
  );
});

const port = parseInt(process.env.PORT || "4000");

console.log(`🚀 Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
