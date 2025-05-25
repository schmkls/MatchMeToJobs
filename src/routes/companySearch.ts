import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  companySearchQuerySchema,
  CompanySearchQuery,
  companyEnrichRequestSchema,
  CompanyEnrichRequest,
  CompanyEnrichResponse,
} from "../schemas/companySchemas.js"; // New schemas
import { AllabolagScraper } from "../services/allabolagScraper.js";
import { CompanyEnrichmentService } from "../services/companyEnrichmentService.js";
import { IndustryMatchingService } from "../services/industryMatchingService.js"; // Added back

const companySearchRouter = new Hono();

/**
 * POST /api/companies/search
 *
 * Uses Allabolag segmentation scraping to find companies.
 * Optionally uses vector matching for industryDescription.
 *
 * PARAMS (from companySearchQuerySchema):
 * - revenueFrom, revenueTo (optional)
 * - location (optional, string)
 * - profitFrom, profitTo (optional)
 * - numEmployeesFrom, numEmployeesTo (optional)
 * - sort (optional, enum: ..., revenueAsc, revenueDesc)
 * - industryDescription (optional, string) - e.g., "software development / saas"
 *
 * EXAMPLE RESPONSE:
 * ["Spotify AB", "GeoGuessr AB", "Anyfin AB"]
 */
companySearchRouter.post("/search", async (c) => {
  try {
    const body = await c.req.json();
    const validatedParams: CompanySearchQuery =
      companySearchQuerySchema.parse(body);

    console.log("Starting company search with params:", validatedParams);

    let industryCodes: string[] = [];
    if (validatedParams.industryDescription) {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        console.warn(
          "OPENAI_API_KEY is not set. Skipping industry description matching."
        );
        // Decide if this should be a hard error or a soft warning based on desired behavior
        // For now, proceeding without industry codes if key is missing.
        // throw new HTTPException(500, { message: "OPENAI_API_KEY is not set. Cannot match industry description." });
      } else {
        console.log(
          `🏭 Matching industry description: "${validatedParams.industryDescription}"...`
        );
        const industryMatcher = new IndustryMatchingService();
        industryCodes = await industryMatcher.matchIndustries(
          validatedParams.industryDescription
        );
        console.log(`🔍 Found industry codes: ${industryCodes.join(", ")}`);
      }
    }

    const scraper = new AllabolagScraper();
    const companyNames = await scraper.searchCompanies(
      validatedParams, // This now includes industryDescription if provided by user, but scraper itself doesn't use it directly for URL building.
      3, // Default maxPages
      industryCodes // Pass the matched codes to the scraper
    );

    if (companyNames.length === 0) {
      return c.json([], 200);
    }

    console.log(`Found ${companyNames.length} companies from Allabolag`);
    return c.json(companyNames, 200);
  } catch (error: any) {
    console.error("Company search error:", error);
    if (error.name === "ZodError") {
      throw new HTTPException(400, {
        message: "Invalid parameters",
        cause: error.errors,
      });
    }
    throw new HTTPException(500, {
      message: "Internal server error",
      cause: error.message,
    });
  }
});

/**
 * POST /api/companies/enrich
 *
 * Enriches a company by searching the web and extracting mission and product summary.
 *
 * PARAMS (from companyEnrichRequestSchema):
 * - companyName (string)
 * - location (optional, string)
 *
 * EXAMPLE RESPONSE:
 * {"product": "...", "mission": "..."}
 */
companySearchRouter.post("/enrich", async (c) => {
  try {
    const body = await c.req.json();
    const { companyName, location }: CompanyEnrichRequest =
      companyEnrichRequestSchema.parse(body);

    console.log(
      `Starting company enrichment for: ${companyName}${
        location ? ` in ${location}` : ""
      }`
    );

    const braveApiKey = process.env.BRAVE_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!braveApiKey || !anthropicApiKey) {
      throw new HTTPException(500, {
        message:
          "Missing required API keys for enrichment. Please set BRAVE_API_KEY and ANTHROPIC_API_KEY.",
      });
    }

    const enrichmentService = new CompanyEnrichmentService(
      braveApiKey,
      anthropicApiKey
    );

    const enrichedData = await enrichmentService.enrichSingleCompany(
      companyName,
      location
    );

    if (!enrichedData) {
      // As per "let it crash" philosophy, perhaps a 404 or specific error is better if enrichment fails.
      // For now, returning empty product/mission as per schema if nothing found.
      // The spec example implies success with data.
      // Consider if a 404 is more appropriate if company cannot be enriched.
      console.warn(`No enrichment data found for ${companyName}`);
      return c.json(
        { product: undefined, mission: undefined } as CompanyEnrichResponse,
        200
      );
    }

    const response: CompanyEnrichResponse = {
      product: enrichedData.product_summary,
      mission: enrichedData.mission,
    };

    console.log(`Enrichment complete for: ${companyName}`);
    return c.json(response, 200);
  } catch (error: any) {
    console.error("Company enrichment error:", error);
    if (error.name === "ZodError") {
      throw new HTTPException(400, {
        message: "Invalid parameters",
        cause: error.errors,
      });
    }
    throw new HTTPException(500, {
      message: "Internal server error",
      cause: error.message,
    });
  }
});

/**
 * GET /api/companies/health
 *
 * Health check endpoint. Now includes OpenAI API key status.
 */
companySearchRouter.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      allabolag_scraper: "operational",
      web_search_enrichment: process.env.BRAVE_API_KEY
        ? "configured"
        : "missing_api_key",
      ai_extraction_enrichment: process.env.ANTHROPIC_API_KEY
        ? "configured"
        : "missing_api_key",
      industry_code_matching: process.env.OPENAI_API_KEY // Added back
        ? "configured"
        : "missing_api_key",
    },
  });
});

export { companySearchRouter };
