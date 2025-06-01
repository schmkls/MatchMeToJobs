import { describe, it, expect } from "vitest";
import app from "../src/index.js"; // Import the Hono app
import dotenv from "dotenv";

// Load environment variables from .env file for testing purposes
dotenv.config();

describe("POST /api/companies/score - Integration Tests", () => {
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
    userProduct: null,
    companyProduct: null,
  };

  const onlyProductQuery = {
    userMission: null,
    companyMission: null,
    userProduct: baseParams.userProduct,
    companyProduct: baseParams.companyProduct,
  };

  const incompleteMissionQuery = {
    userMission: baseParams.userMission,
    userProduct: null,
    companyProduct: null,
  }; // companyMission missing

  const incompleteProductQuery = {
    userProduct: baseParams.userProduct,
    userMission: null,
    companyMission: null,
  }; // companyProduct missing

  const noPairsQuery = {
    userMission: baseParams.userMission,
    companyProduct: baseParams.companyProduct,
    userProduct: null,
    companyMission: null,
  }; // Mismatched pair

  const emptyQuery = {
    userMission: null,
    companyMission: null,
    userProduct: null,
    companyProduct: null,
  };

  // Helper to check API key and skip tests
  const isApiKeyMissing = () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(
        "Skipping /api/companies/score test: ANTHROPIC_API_KEY not found. This test relies on real model calls."
      );
      return true; // Skip
    }
    return false; // Don't skip
  };

  it("should return scores for both mission and product when all params provided", async () => {
    if (isApiKeyMissing()) return;
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(baseParams),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmMissionScore).toBeTypeOf("number");
    expect(body.ceMissionScore).toBeTypeOf("number");
    expect(body.llmProductScore).toBeTypeOf("number");
    expect(body.ceProductScore).toBeTypeOf("number");
  }, 60000);

  it("should return mission scores (product scores null) when only mission params provided", async () => {
    if (isApiKeyMissing()) return;
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(onlyMissionQuery),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmMissionScore).toBeTypeOf("number");
    expect(body.ceMissionScore).toBeTypeOf("number");
    expect(body.llmProductScore).toBeNull();
    expect(body.ceProductScore).toBeNull();
  }, 45000);

  it("should return product scores (mission scores null) when only product params provided", async () => {
    if (isApiKeyMissing()) return;
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(onlyProductQuery),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llmProductScore).toBeTypeOf("number");
    expect(body.ceProductScore).toBeTypeOf("number");
    expect(body.llmMissionScore).toBeNull();
    expect(body.ceMissionScore).toBeNull();
  }, 45000);

  it("should return 400 if userMission provided without companyMission", async () => {
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(incompleteMissionQuery),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body");
    expect(body.details[0].message).toContain(
      "If userMission is provided, companyMission must also be provided"
    );
  });

  it("should return 400 if userProduct provided without companyProduct", async () => {
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(incompleteProductQuery),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body");
    expect(body.details[0].message).toContain(
      "If userProduct is provided, companyProduct must also be provided"
    );
  });

  it("should return 400 if no complete pairs are provided (mismatched pair)", async () => {
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(noPairsQuery),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body");
    expect(
      body.details.some((d: any) =>
        d.message.includes("at least one complete pair")
      )
    ).toBe(true);
  });

  it("should return 400 if query is empty (no pairs provided)", async () => {
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emptyQuery),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body");
    expect(body.details[0].message).toContain(
      "At least one complete pair (mission or product) must be provided"
    );
  });

  it("should return 400 if a required part of a provided pair is an empty string", async () => {
    const queryWithEmptyString = {
      userMission: baseParams.userMission,
      companyMission: "",
      userProduct: null,
      companyProduct: null,
    };
    const res = await app.request(`/api/companies/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queryWithEmptyString),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body");
    expect(body.details[0].message).toContain(
      "Company mission cannot be empty"
    );
  });
});
