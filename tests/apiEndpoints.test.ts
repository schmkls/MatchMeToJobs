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
    const requestBody = { companyName };

    it("should enrich a company successfully with product and mission", async () => {
      // Ensure API keys are available for this test
      if (!process.env.OPENAI_API_KEY) {
        console.log("Skipping enrichment test: OPENAI_API_KEY not found.");
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
      console.log("Retrieved mission:", responseBody.mission); // DEBUG: Log mission
      expect(responseBody.mission.length).toBeGreaterThan(10); // Mission should be substantial
    }, 45000); // Increased timeout for external API calls

    it("should return 400 for invalid request body (missing companyName)", async () => {
      const res = await app.request("/api/companies/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Empty body, will fail companyName validation
      });
      expect(res.status).toBe(400);
      // const errorResponse = await res.json(); // No longer needed if not checking message
      // expect(errorResponse.message).toBe("Invalid parameters"); // Removed as per user request
      // Check for more specific error details if necessary
      // expect(errorResponse.cause[0].message).toBe( // Removed as per user request
      //   "Company name cannot be empty"
      // );
    });
  });
});

// --- Updated tests for /api/companies/score ---
describe("GET /api/companies/score - Integration Tests", () => {
  const baseParams = {
    userMission: "Empower small businesses with technology",
    userProduct: "SAAS for e-commerce analytics",
    companyMission:
      "To provide innovative tech solutions for SMBs globally, fostering growth and efficiency.",
    companyProduct:
      "A comprehensive SAAS platform offering data analytics and insights for online retailers.",
  };

  const onlyMissionQuery = {
    userMission: baseParams.userMission,
    companyMission: baseParams.companyMission,
  };

  const onlyProductQuery = {
    userProduct: baseParams.userProduct,
    companyProduct: baseParams.companyProduct,
  };

  const incompleteMissionQuery = { userMission: baseParams.userMission }; // companyMission missing
  const incompleteProductQuery = { userProduct: baseParams.userProduct }; // companyProduct missing
  const noPairsQuery = {
    userMission: baseParams.userMission,
    companyProduct: baseParams.companyProduct,
  }; // Mismatched pair
  const emptyQuery = {};

  // Helper to check API key and skip tests
  const checkApiKeysAndSkip = () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(
        "Skipping /api/companies/score test: ANTHROPIC_API_KEY not found. This test relies on real model calls."
      );
      return true; // Skip
    }
    // OPENAI_API_KEY is not directly used by the score service itself, but by other services.
    // The CompanyScorerService doesn't depend on it, so we don't strictly need to check it here for /score tests.
    // However, keeping the check if there are concerns about shared environment setup or indirect dependencies.
    // if (!process.env.OPENAI_API_KEY) {
    //   console.warn(
    //     "Skipping /api/companies/score test: OPENAI_API_KEY not found."
    //   );
    //   return true; // Skip
    // }
    return false; // Don't skip
  };

  it("should return scores for both mission and product when all params provided", async () => {
    if (checkApiKeysAndSkip()) return;
    const queryString = new URLSearchParams(baseParams).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmMissionScore).toBeTypeOf("number");
    expect(body.ceMissionScore).toBeTypeOf("number");
    expect(body.llmProductScore).toBeTypeOf("number");
    expect(body.ceProductScore).toBeTypeOf("number");
  }, 60000);

  it("should return mission scores (product scores null) when only mission params provided", async () => {
    if (checkApiKeysAndSkip()) return;
    const queryString = new URLSearchParams(onlyMissionQuery).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmMissionScore).toBeTypeOf("number");
    expect(body.ceMissionScore).toBeTypeOf("number");
    expect(body.llmProductScore).toBeNull();
    expect(body.ceProductScore).toBeNull();
  }, 45000);

  it("should return product scores (mission scores null) when only product params provided", async () => {
    if (checkApiKeysAndSkip()) return;
    const queryString = new URLSearchParams(onlyProductQuery).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmProductScore).toBeTypeOf("number");
    expect(body.ceProductScore).toBeTypeOf("number");
    expect(body.llmMissionScore).toBeNull();
    expect(body.ceMissionScore).toBeNull();
  }, 45000);

  it("should return 400 if userMission provided without companyMission", async () => {
    const queryString = new URLSearchParams(incompleteMissionQuery).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
    expect(body.details[0].message).toContain(
      "If userMission is provided, companyMission must also be provided"
    );
  });

  it("should return 400 if userProduct provided without companyProduct", async () => {
    const queryString = new URLSearchParams(incompleteProductQuery).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
    expect(body.details[0].message).toContain(
      "If userProduct is provided, companyProduct must also be provided"
    );
  });

  it("should return 400 if no complete pairs are provided (mismatched pair)", async () => {
    const queryString = new URLSearchParams(noPairsQuery).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
    // This will trigger both pair consistency errors and the "at least one complete pair" error.
    // The exact error message might depend on Zod's error reporting order, checking for one is fine.
    expect(
      body.details.some((d: any) =>
        d.message.includes("at least one complete pair")
      )
    ).toBe(true);
  });

  it("should return 400 if query is empty (no pairs provided)", async () => {
    const queryString = new URLSearchParams(emptyQuery as any).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
    expect(body.details[0].message).toContain(
      "At least one complete pair (mission or product) must be provided"
    );
  });

  // Original test for empty string in a parameter (now handled by Zod .min(1) and optional)
  // This specific case might be covered by the pair validation or if an empty string is passed for an otherwise valid pair.
  it("should return 400 if a required part of a provided pair is an empty string", async () => {
    const queryWithEmptyString = {
      userMission: baseParams.userMission,
      companyMission: "",
    };
    const queryString = new URLSearchParams(queryWithEmptyString).toString();
    const res = await app.request(`/api/companies/score?${queryString}`, {
      method: "GET",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid query parameters");
    expect(body.details[0].message).toContain(
      "Company mission cannot be empty"
    );
  });
});
