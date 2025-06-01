import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/index.js"; // Import the Hono app
import dotenv from "dotenv";

// Load environment variables from .env file for testing purposes
dotenv.config();

describe("POST /api/companies/search", () => {
  beforeAll(() => {
    // Ensure OPENAI_API_KEY is loaded, as it might be used by the search service for industry matching
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set. Search tests involving industry matching may fail or be skipped."
      );
    }
  });

  it("should find companies including Mainter AB for Umeå, 0-10 employees, software/saas, sort by revenueDesc", async () => {
    const requestBody = {
      location: "Umeå",
      numEmployeesFrom: 0,
      numEmployeesTo: 10,
      sort: "revenueDesc",
      industryDescription: "software development / saas",
    };

    // Make sure OPENAI_API_KEY is available for this test to run properly, as industry matching relies on it
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "Skipping test: OPENAI_API_KEY not found, required for industry matching in company search."
      );
      return;
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

    expect(responseBody.length).toBeGreaterThanOrEqual(5);

    const companyNames = responseBody.map(
      (
        company: { name: string } // Assuming company object has a name property
      ) => company.name.toLowerCase()
    );
    expect(companyNames).toContain("mainter ab");
  }, 30000);

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
});
