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
 * 2. AI-powered industry matching (converts descriptions like "software development" to Swedish codes)
 * 3. Company enrichment (web search + AI extraction for mission & product)
 *
 * Environment variables required:
 * - ANTHROPIC_API_KEY: For AI company enrichment
 * - BRAVE_API_KEY: For web search during company enrichment
 * - OPENAI_API_KEY: For AI industry matching (embeddings)
 * - PORT: Server port (default: 4000)
 *
 * Main endpoints:
 * POST /api/companies/search - Find companies based on criteria, including industry description.
 * POST /api/companies/enrich - Enrich a specific company with mission and product summary.
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
    version: "1.2.0",
    description:
      "Search for companies (with industry matching) and enrich company data. Future: job matching.",
    endpoints: {
      "POST /api/companies/search": {
        description:
          "Searches for companies using Allabolag segmentation scraping. Optionally uses vector matching for industryDescription to find relevant Swedish industry codes (proffIndustryCode).",
        parameters: [
          {
            name: "revenueFrom",
            type: "number",
            optional: true,
            description: "Min revenue (-221349 to 192505000)",
          },
          {
            name: "revenueTo",
            type: "number",
            optional: true,
            description: "Max revenue (-221349 to 192505000)",
          },
          {
            name: "location",
            type: "string",
            optional: true,
            description: "e.g., Stockholm",
          },
          {
            name: "profitFrom",
            type: "number",
            optional: true,
            description: "Min profit (-12153147 to 109441000)",
          },
          {
            name: "profitTo",
            type: "number",
            optional: true,
            description: "Max profit (-12153147 to 109441000)",
          },
          {
            name: "numEmployeesFrom",
            type: "number",
            optional: true,
            description: "Min employees (0 to 100000)",
          },
          {
            name: "numEmployeesTo",
            type: "number",
            optional: true,
            description: "Max employees (0 to 100000)",
          },
          {
            name: "sort",
            type: "enum",
            optional: true,
            description:
              "Sort order: profitAsc, profitDesc, registrationDateDesc, numEmployeesAsc, numEmployeesDesc, revenueAsc, revenueDesc",
          },
          {
            name: "industryDescription",
            type: "string",
            optional: true,
            description:
              "e.g., software development / saas. Gets converted to industry codes.",
          },
        ],
        example_request: {
          location: "Göteborg",
          revenueFrom: 1000000,
          sort: "revenueDesc",
          industryDescription: "consulting firm in IT",
        },
        example_response: ["Company X AB", "Another Company Ltd"],
      },
      "POST /api/companies/enrich": {
        description:
          "Enriches a company by searching the web for its mission and product summary.",
        parameters: [
          {
            name: "companyName",
            type: "string",
            optional: false,
            description: "Name of the company to enrich",
          },
          {
            name: "location",
            type: "string",
            optional: true,
            description: "Location of the company (for more specific search)",
          },
        ],
        example_request: {
          companyName: "Spotify AB",
          location: "Stockholm",
        },
        example_response: {
          product: "Music streaming service...",
          mission: "To unlock the potential of human creativity...",
        },
      },
      "GET /api/companies/health": {
        description: "Health check and service status",
      },
    },
    features_current: {
      company_search: "Filter and search Swedish companies via Allabolag",
      industry_matching:
        "AI-powered industry code matching (from description to proffIndustryCode)",
      company_enrichment:
        "Web search + AI extraction for company mission & product summary",
    },
    features_future: ["Job search", "Job ranking", "Company ranking"],
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
