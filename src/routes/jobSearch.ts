import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { jobSearchParamsSchema } from "../schemas/jobSearch.js";
import type { JobSearchParams } from "../schemas/jobSearch.js";
import { AllabolagScraper } from "../services/allabolagScraper.js";
import { CompanyEnrichmentService } from "../services/companyEnrichmentService.js";
import { IndustryMatchingService } from "../services/industryMatchingService.js";

const jobSearchRouter = new Hono();

jobSearchRouter.post("/search", async (c) => {
  try {
    // Parse and validate the request body
    const body = await c.req.json();
    const validatedParams: JobSearchParams = jobSearchParamsSchema.parse(body);

    console.log("Starting job search with params:", validatedParams);

    // Check for required environment variables
    const braveApiKey = process.env.BRAVE_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!braveApiKey || !anthropicApiKey) {
      throw new HTTPException(500, {
        message:
          "Missing required API keys. Please set BRAVE_API_KEY and ANTHROPIC_API_KEY in environment.",
      });
    }

    // Step 0: Match industry codes if industryDescription is provided
    let industryCodes: string[] = [];
    if (validatedParams.industryDescription) {
      console.log("🏭 Matching industry description to codes...");
      const industryMatcher = new IndustryMatchingService(anthropicApiKey);
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
          withNews: 0,
        },
        metadata: {
          allabolag_total: 0,
          enriched_count: 0,
          search_params: validatedParams,
          industry_codes: industryCodes,
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
      10 // Limit to 10 companies to control costs and response time
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
        industry_codes: industryCodes,
      },
    });
  } catch (error: any) {
    console.error("Job search error:", error);

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

// Health check endpoint
jobSearchRouter.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      allabolag: "operational",
      web_search: process.env.BRAVE_API_KEY ? "configured" : "missing_api_key",
      ai_extraction: process.env.ANTHROPIC_API_KEY
        ? "configured"
        : "missing_api_key",
      industry_matching: process.env.ANTHROPIC_API_KEY
        ? "configured"
        : "missing_api_key",
    },
  });
});

export { jobSearchRouter };
