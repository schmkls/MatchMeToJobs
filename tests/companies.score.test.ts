import { describe, it, expect } from "vitest";
import app from "../src/index.js"; // Import the Hono app
import dotenv from "dotenv";

// Load environment variables from .env file for testing purposes
dotenv.config();

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
