import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  companySearchQuerySchema,
  CompanySearchQuery,
  companyEnrichRequestSchema,
  CompanyEnrichRequest,
  companyEnrichResponseSchema,
  CompanyEnrichResponse,
} from "@schemas/companySchemas";
import type { CompanyScoreResponse } from "@appTypes/companyScore.types";
import {
  companyScoreRequestQuerySchema,
  CompanyScoreRequestQuery,
} from "@schemas/companyScoreSchemas";
import { AllabolagScraper } from "@services/allabolagScraper";
import { CompanyEnrichmentService } from "@services/companyEnricher";
import { IndustryMatchingService } from "@services/industryMatcher";
import { CompanyScorerService } from "@services/companyScorer";

const companyRouter = new Hono();

// Instantiate services once
console.log("[DEBUG src/routes/companySearch.ts] At service instantiation:");
console.log(
  "[DEBUG src/routes/companySearch.ts] OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY ? "SET" : "NOT SET"
);

const allabolagScraper = new AllabolagScraper();
const openaiApiKey = process.env.OPENAI_API_KEY;

let companyEnrichmentService: CompanyEnrichmentService | null = null;
const companyScorerService = new CompanyScorerService();

if (openaiApiKey) {
  companyEnrichmentService = new CompanyEnrichmentService(openaiApiKey);
} else {
  console.warn(
    "Missing OPENAI_API_KEY. Company enrichment will be unavailable."
  );
}

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
companyRouter.post("/search", async (c) => {
  try {
    const body = await c.req.json();
    const validatedParams: CompanySearchQuery =
      companySearchQuerySchema.parse(body);

    // Validate that if one of a pair (From/To) is provided, the other must also be present
    if (
      (validatedParams.revenueTo !== undefined &&
        validatedParams.revenueFrom === undefined) ||
      (validatedParams.revenueFrom !== undefined &&
        validatedParams.revenueTo === undefined)
    ) {
      throw new HTTPException(400, {
        message:
          "Both revenueFrom and revenueTo must be provided if one is present.",
      });
    }
    if (
      (validatedParams.profitTo !== undefined &&
        validatedParams.profitFrom === undefined) ||
      (validatedParams.profitFrom !== undefined &&
        validatedParams.profitTo === undefined)
    ) {
      throw new HTTPException(400, {
        message:
          "Both profitFrom and profitTo must be provided if one is present.",
      });
    }
    if (
      (validatedParams.numEmployeesTo !== undefined &&
        validatedParams.numEmployeesFrom === undefined) ||
      (validatedParams.numEmployeesFrom !== undefined &&
        validatedParams.numEmployeesTo === undefined)
    ) {
      throw new HTTPException(400, {
        message:
          "Both numEmployeesFrom and numEmployeesTo must be provided if one is present.",
      });
    }

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

    // Use the module-level allabolagScraper instance
    const companyNames = await allabolagScraper.searchCompanies(
      validatedParams,
      3, // Default maxPages
      industryCodes
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
companyRouter.post("/enrich", async (c) => {
  if (!companyEnrichmentService) {
    throw new HTTPException(503, {
      message:
        "Company enrichment service is not available due to missing OPENAI_API_KEY.",
    });
  }

  try {
    const body = await c.req.json();
    // Destructure only companyName, as location is removed from schema and request
    const { companyName }: CompanyEnrichRequest =
      companyEnrichRequestSchema.parse(body);

    console.log(
      `Starting company enrichment for: ${companyName}` // Removed location from log
    );

    // Use the module-level companyEnrichmentService instance, passing only companyName
    const enrichedData = await companyEnrichmentService.enrichSingleCompany(
      companyName
      // location parameter removed
    );

    if (!enrichedData) {
      // If enrichment fails or returns no data, send a 404
      throw new HTTPException(404, {
        message: `Could not find or enrich company: ${companyName}`, // Removed location from message
      });
    }

    // Construct the response based on the schema (which allows optional fields)
    const responsePayload: CompanyEnrichResponse = {
      product: enrichedData.product_summary,
      mission: enrichedData.mission,
    };

    // Validate the response against the schema before sending
    const validatedResponse =
      companyEnrichResponseSchema.parse(responsePayload);

    console.log(`Enrichment complete for: ${companyName}`);
    return c.json(validatedResponse, 200);
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

// Convert from GET to POST for /api/companies/score endpoint
companyRouter.post("/score", async (c) => {
  try {
    const body = await c.req.json();
    // Validate request body using Zod
    const validatedParams: CompanyScoreRequestQuery =
      companyScoreRequestQuerySchema.parse(body);

    const scoreResponse: CompanyScoreResponse = // Type assertion for clarity, ensure service returns this
      await companyScorerService.scoreCompany(validatedParams); // Pass validatedParams

    return c.json(scoreResponse, 200);
  } catch (error: any) {
    console.error("Company scoring error:", error);
    if (error instanceof HTTPException) {
      throw error;
    }
    // Add ZodError handling
    if (error.name === "ZodError") {
      throw new HTTPException(400, {
        message: "Invalid request body",
        cause: error.errors,
      });
    }
    throw new HTTPException(500, {
      message: "Internal server error during scoring",
      cause: error.message,
    });
  }
});

/**
 * GET /api/companies/health
 *
 * Health check endpoint. Now includes OpenAI API key status.
 */
companyRouter.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      allabolag_scraper: "operational",
      openai_enrichment: process.env.OPENAI_API_KEY
        ? "configured"
        : "missing_api_key",
      industry_code_matching: process.env.OPENAI_API_KEY
        ? "configured"
        : "missing_api_key",
    },
  });
});

export { companyRouter as companySearchRouter };
