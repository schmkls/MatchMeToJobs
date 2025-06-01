import { describe, it, expect } from "vitest";
import app from "../src/index.js"; // Import the Hono app
import dotenv from "dotenv";

// Load environment variables from .env file for testing purposes
dotenv.config();

describe("POST /api/companies/enrich", () => {
  const companyName = "Spotify AB";
  const requestBody = { companyName };

  it("should enrich a company successfully with product and mission", async () => {
    // Ensure API keys are available for this test
    if (!process.env.OPENAI_API_KEY) {
      console.warn("Skipping enrichment test: OPENAI_API_KEY not found.");
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

  it("should return 400 for invalid request body (missing companyName)", async () => {
    const res = await app.request("/api/companies/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // Empty body, will fail companyName validation
    });
    expect(res.status).toBe(400);
  });
});
