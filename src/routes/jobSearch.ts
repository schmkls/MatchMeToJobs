import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { jobSearchParamsSchema } from "../schemas/jobSearch.js";
import type { JobSearchParams } from "../schemas/jobSearch.js";
import { AllabolagScraper } from "../services/allabolagScraper.js";

const jobSearchRouter = new Hono();

jobSearchRouter.post("/search", async (c) => {
  try {
    // Parse and validate the request body
    const body = await c.req.json();
    const validatedParams: JobSearchParams = jobSearchParamsSchema.parse(body);

    console.log("Starting job search with params:", validatedParams);

    // Initialize the Allabolag scraper
    const scraper = new AllabolagScraper();

    // Search for companies on Allabolag (limit to 2 pages for now to keep it fast)
    const companies = await scraper.searchCompanies(validatedParams, 2);

    return c.json({
      success: true,
      message: "Job search completed successfully",
      params: validatedParams,
      results: {
        companies: companies,
        total: companies.length,
        source: "allabolag",
      },
    });
  } catch (error: any) {
    // Handle Zod validation errors
    if (error.name === "ZodError") {
      const issues = error.issues.map((issue: any) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));

      return c.json(
        {
          success: false,
          message: "Validation failed",
          errors: issues,
        },
        400
      );
    }

    // Handle other errors
    console.error("Job search error:", error);
    return c.json(
      {
        success: false,
        message: error.message || "Internal server error",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      500
    );
  }
});

// Health check endpoint
jobSearchRouter.get("/health", (c) => {
  return c.json({
    success: true,
    message: "Job search service is healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

export { jobSearchRouter };
