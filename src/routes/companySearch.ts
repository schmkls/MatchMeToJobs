import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { jobSearchParamsSchema } from "../schemas/jobSearch.js";
import type { JobSearchParams } from "../schemas/jobSearch.js";
import { AllabolagScraper } from "../services/allabolagScraper.js";
import { CompanyEnrichmentService } from "../services/companyEnrichmentService.js";
import { IndustryMatchingService } from "../services/industryMatchingService.js";

const companySearchRouter = new Hono();

/**
 * POST /api/companies/search
 *
 * Main company search endpoint that:
 * 1. Matches industry description to Swedish industry codes (if provided)
 * 2. Searches Allabolag for companies matching criteria
 * 3. Enriches company data with web search and AI extraction
 *
 * REQUIRED PARAMETERS:
 * - description: string (10-1000 chars) - Company description/what you're looking for
 *
 * OPTIONAL PARAMETERS:
 * - location: string - Location to search (e.g., "Stockholm", "Göteborg")
 * - industryDescription: string (5-500 chars) - Industry type (e.g., "software development", "healthcare")
 * - revenueFrom/revenueTo: number - Company revenue range in SEK
 * - profitFrom/profitTo: number - Company profit range in SEK
 * - numEmployeesFrom/numEmployeesTo: number - Company size range
 * - sort: enum - Sort order (profitAsc, revenueDesc, etc.)
 *
 * EXAMPLE REQUEST:
 * {
 *   "description": "Looking for software development companies",
 *   "location": "Stockholm",
 *   "industryDescription": "software development",
 *   "revenueFrom": 1000000
 * }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Found and enriched X companies",
 *   "companies": [...],
 *   "stats": {...},
 *   "metadata": {
 *     "industry_codes": ["10002115", "10002102", ...] // Matched industry codes
 *   }
 * }
 */
companySearchRouter.post("/search", async (c) => {
  try {
    // Parse and validate the request body
    const body = await c.req.json();
    const validatedParams: JobSearchParams = jobSearchParamsSchema.parse(body);

    console.log("Starting company search with params:", validatedParams);

    // Check for required environment variables
    const braveApiKey = process.env.BRAVE_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!braveApiKey || !anthropicApiKey || !openaiApiKey) {
      throw new HTTPException(500, {
        message:
          "Missing required API keys. Please set BRAVE_API_KEY, ANTHROPIC_API_KEY, and OPENAI_API_KEY in environment.",
      });
    }

    // Step 0: Match industry codes if industryDescription is provided
    // This uses OpenAI embeddings for vector similarity matching
    let industryCodes: string[] = [];
    if (validatedParams.industryDescription) {
      console.log("🏭 Matching industry description to codes...");
      const industryMatcher = new IndustryMatchingService();
      industryCodes = await industryMatcher.matchIndustries(
        validatedParams.industryDescription
      );

      if (industryCodes.length > 0) {
        console.log(
          `Found ${industryCodes.length} industry matches for: "${validatedParams.industryDescription}"`
        );
      } else {
        console.log(
          `No industry matches found for: "${validatedParams.industryDescription}"`
        );
      }
    }

    // Step 1: Search for companies on Allabolag (limit to 2 pages for faster response)
    // Industry codes are automatically added as &proffIndustryCode=X,Y,Z parameter
    console.log("🏢 Searching Allabolag for companies...");
    const scraper = new AllabolagScraper();
    const companies = await scraper.searchCompanies(
      validatedParams,
      2,
      industryCodes
    );

    if (companies.length === 0) {
      return c.json({
        success: true,
        message: "No companies found matching the criteria",
        companies: [],
        stats: {
          total: 0,
          withMission: 0,
          withProduct: 0,
          withJobs: 0,
        },
        metadata: {
          allabolag_total: 0,
          enriched_count: 0,
          search_params: validatedParams,
          industry_codes: industryCodes, // Shows which codes were used
        },
      });
    }

    console.log(`Found ${companies.length} companies from Allabolag`);

    // Step 2: Enrich companies with web search and AI extraction (limit to 10 companies)
    console.log("🌐 Enriching companies with web search and AI...");
    const enrichmentService = new CompanyEnrichmentService(
      braveApiKey,
      anthropicApiKey
    );
    const enrichedCompanies = await enrichmentService.enrichCompanies(
      companies,
      5 // Limit to 5 companies to control costs and response time
    );

    // Step 3: Get enrichment statistics
    const stats = enrichmentService.getEnrichmentStats(enrichedCompanies);

    console.log(`Enrichment complete:`, stats);

    return c.json({
      success: true,
      message: `Found and enriched ${enrichedCompanies.length} companies`,
      companies: enrichedCompanies,
      stats: stats,
      metadata: {
        allabolag_total: companies.length,
        enriched_count: enrichedCompanies.length,
        search_params: validatedParams,
        industry_codes: industryCodes, // Shows which Swedish industry codes were matched
      },
    });
  } catch (error: any) {
    console.error("Company search error:", error);

    // Handle Zod validation errors
    if (error.name === "ZodError") {
      throw new HTTPException(400, {
        message: "Invalid parameters",
        cause: error.errors,
      });
    }

    // Handle other errors
    throw new HTTPException(500, {
      message: "Internal server error",
      cause: error.message,
    });
  }
});

/**
 * GET /api/companies/health
 *
 * Health check endpoint to verify all services are configured correctly
 *
 * RESPONSE:
 * {
 *   "status": "healthy",
 *   "services": {
 *     "allabolag": "operational",
 *     "web_search": "configured|missing_api_key",
 *     "ai_extraction": "configured|missing_api_key",
 *     "industry_matching": "configured|missing_api_key"
 *   }
 * }
 */
companySearchRouter.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      allabolag: "operational",
      web_search: process.env.BRAVE_API_KEY ? "configured" : "missing_api_key",
      ai_extraction: process.env.ANTHROPIC_API_KEY
        ? "configured"
        : "missing_api_key",
      industry_matching: process.env.OPENAI_API_KEY
        ? "configured"
        : "missing_api_key",
    },
  });
});

export { companySearchRouter };
