import dotenv from "dotenv";
// Load environment variables FIRST
dotenv.config();

console.log("[DEBUG src/index.ts] After dotenv.config():");
console.log(
  "[DEBUG src/index.ts] OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY ? "SET" : "NOT SET"
);

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { companySearchRouter } from "./routes/company.js";

/**
 * MatchMeToJobs API Server
 *
 * Main features:
 * 1. Company search with financial/size filters (via Allabolag scraping)
 * 2. AI-powered industry matching (converts descriptions like "software development" to Swedish codes)
 * 3. Company enrichment (web search + AI extraction for mission & product)
 *
 * Environment variables required:
 * - OPENAI_API_KEY: For AI industry matching (embeddings) and company enrichment
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
        ],
        example_request: {
          companyName: "Spotify AB",
        },
        example_response: {
          product: "Music streaming service...",
          mission: "To unlock the potential of human creativity...",
        },
      },
      "GET /api/companies/score": {
        description:
          "Scores a company by comparing its mission and product with user preferences using LLM and Cross-Encoder models. " +
          "Requires at least one complete pair of parameters (e.g., userMission and companyMission, or userProduct and companyProduct). " +
          "If a pair is provided (e.g., userMission), its counterpart (e.g., companyMission) must also be provided.",
        parameters: [
          {
            name: "userMission",
            type: "string",
            optional: true,
            description:
              "User's desired company mission. If provided, companyMission is also required.",
          },
          {
            name: "userProduct",
            type: "string",
            optional: true,
            description:
              "User's desired company product/service category. If provided, companyProduct is also required.",
          },
          {
            name: "companyMission",
            type: "string",
            optional: true,
            description:
              "The company's actual mission statement. If provided, userMission is also required.",
          },
          {
            name: "companyProduct",
            type: "string",
            optional: true,
            description:
              "The company's actual product/service description. If provided, userProduct is also required.",
          },
        ],
        example_request_url_params:
          "?userMission=Enable%20artists%20to%20live%20off%20their%20art&companyMission=Empower%20creators%20globally%20through%20innovative%20tools",
        example_response: {
          llmMissionScore: 0.85,
          llmProductScore: null,
          ceMissionScore: 0.78,
          ceProductScore: null,
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
