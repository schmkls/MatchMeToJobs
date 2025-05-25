import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/index.js"; // Import the Hono app
import dotenv from "dotenv";

// Load environment variables from .env file for testing purposes
dotenv.config();

describe("Company API Endpoints - Integration Tests", () => {
  beforeAll(() => {
    // Ensure necessary API keys are loaded for real calls
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set. Industry matching tests may fail or be skipped."
      );
    }
    // Add checks for BRAVE_API_KEY and ANTHROPIC_API_KEY if testing /enrich later
  });

  describe("POST /api/companies/search", () => {
    it("should find companies including Mainter AB for Umeå, 0-10 employees, software/saas, sort by revenueDesc", async () => {
      const requestBody = {
        location: "Umeå",
        numEmployeesFrom: 0,
        numEmployeesTo: 10,
        sort: "revenueDesc",
        industryDescription: "software development / saas",
      };

      // Make sure OPENAI_API_KEY is available for this test to run properly
      if (!process.env.OPENAI_API_KEY) {
        console.warn("Skipping test: OPENAI_API_KEY not found.");
        return; // Or use it.skip if vitest supports it directly in this context
      }

      const res = await app.request("/api/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const responseBody = await res.json();

      expect(Array.isArray(responseBody)).toBe(true);
      console.log(
        "Found companies for Umeå, 0-10 employees, software/saas, revenueDesc:",
        responseBody
      );

      // Check if the response contains at least 5 companies
      expect(responseBody.length).toBeGreaterThanOrEqual(5);

      // Check if "Mainter AB" is in the list of company names
      // Note: Allabolag data can change, this might be brittle
      const companyNames = responseBody.map((name: string) =>
        name.toLowerCase()
      );
      expect(companyNames).toContain("mainter ab");
    }, 30000); // Increase timeout for real API calls including embeddings

    it("should return 400 for invalid parameters (e.g., bad sort option)", async () => {
      const requestBody = {
        location: "Stockholm",
        sort: "invalidSortOption",
      };

      const res = await app.request("/api/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      expect(res.status).toBe(400);
      const errorResponse = await res.json();
      expect(errorResponse.error).toBe("Invalid parameters");
    });

    // Add more tests for /api/companies/search later
  });

  describe("POST /api/companies/enrich", () => {
    const companyName = "Spotify AB";
    const requestBody = { companyName, location: "Stockholm" };

    it("should enrich a company successfully with product and mission", async () => {
      // Ensure API keys are available for this test
      if (!process.env.BRAVE_API_KEY || !process.env.ANTHROPIC_API_KEY) {
        console.warn(
          "Skipping enrichment test: BRAVE_API_KEY or ANTHROPIC_API_KEY not found."
        );
        return;
      }

      const res = await app.request("/api/companies/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      expect(res.status).toBe(200);
      const responseBody = await res.json();
      console.log(`Enrichment response for ${companyName}:`, responseBody);

      expect(responseBody).toHaveProperty("product");
      expect(responseBody).toHaveProperty("mission");
      expect(typeof responseBody.product).toBe("string");
      expect(responseBody.product.toLowerCase()).toContain("streaming");
      expect(typeof responseBody.mission).toBe("string");
      expect(responseBody.mission.length).toBeGreaterThan(10); // Mission should be substantial
    }, 45000); // Increased timeout for external API calls

    it("should return 404 for a company that cannot be enriched", async () => {
      if (!process.env.BRAVE_API_KEY || !process.env.ANTHROPIC_API_KEY) {
        console.warn(
          "Skipping enrichment 404 test: BRAVE_API_KEY or ANTHROPIC_API_KEY not found."
        );
        return;
      }
      const nonExistentCompany = {
        companyName: "NonExistentMegaCorp123XYZ",
        location: "Nowhere",
      };
      const res = await app.request("/api/companies/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nonExistentCompany),
      });
      expect(res.status).toBe(404);
      const errorResponse = await res.json();
      expect(errorResponse.message).toContain(
        "Could not find or enrich company"
      );
    }, 30000);

    it("should return 400 for invalid request body (missing companyName)", async () => {
      const res = await app.request("/api/companies/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "SomeLocation" }), // Missing companyName
      });
      expect(res.status).toBe(400);
      const errorResponse = await res.json();
      expect(errorResponse.message).toBe("Invalid parameters"); // Assuming Hono returns this for Zod errors
      // Check for more specific error details if necessary
      expect(errorResponse.cause[0].message).toBe(
        "Company name cannot be empty"
      );
    });

    // Test for 503 when API keys are missing - this requires modifying the app or environment for the test run.
    // This can be complex to set up in a way that doesn't affect other tests.
    // For now, this scenario is manually tested or assumed covered by the console warning in app setup.
    // Alternatively, one could mock the service or environment variables for this specific test.
  });
});
