import { describe, it, expect, beforeAll } from "vitest";
import { WebSearchService } from "../src/services/webSearchService.js";
import { AIExtractionService } from "../src/services/aiExtractionService.js";
import { CompanyEnrichmentService } from "../src/services/companyEnrichmentService.js";
import dotenv from "dotenv";

// Load environment variables for testing
dotenv.config();

describe("Web Search and AI Extraction Integration", () => {
  let webSearchService: WebSearchService;
  let aiExtractionService: AIExtractionService;
  let enrichmentService: CompanyEnrichmentService;

  beforeAll(() => {
    const braveApiKey = process.env.BRAVE_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!braveApiKey || !anthropicApiKey) {
      console.warn("⚠️ Skipping integration tests - API keys not configured");
      console.warn(
        "Set BRAVE_API_KEY and ANTHROPIC_API_KEY environment variables to run these tests"
      );
    }

    if (braveApiKey) {
      webSearchService = new WebSearchService(braveApiKey);
    }
    if (anthropicApiKey) {
      aiExtractionService = new AIExtractionService(anthropicApiKey);
    }
    if (braveApiKey && anthropicApiKey) {
      enrichmentService = new CompanyEnrichmentService(
        braveApiKey,
        anthropicApiKey
      );
    }
  });

  describe("Web Search Service", () => {
    it("should search for company information", async () => {
      if (!webSearchService) {
        console.log("⏭️ Skipping web search test - BRAVE_API_KEY not set");
        return;
      }

      const companyName = "AstraZeneca AB";
      const results = await webSearchService.searchCompanyInfo(companyName);

      expect(results).toBeDefined();
      expect(results).toHaveProperty("mission");
      expect(results).toHaveProperty("product");
      expect(results).toHaveProperty("jobs");
      expect(results).toHaveProperty("news");
      expect(results).toHaveProperty("contact");

      // Should have some search results
      const totalResults = Object.values(results).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      expect(totalResults).toBeGreaterThan(0);

      console.log(
        `Found ${totalResults} total search results for ${companyName}`
      );
    }, 30000); // 30 second timeout for API calls

    it("should extract meaningful content from search results", () => {
      if (!webSearchService) {
        console.log(
          "⏭️ Skipping content extraction test - BRAVE_API_KEY not set"
        );
        return;
      }

      const mockResults = [
        {
          title: "AstraZeneca - Leading Pharmaceutical Company",
          url: "https://www.astrazeneca.com",
          description:
            "AstraZeneca is a global pharmaceutical company focused on discovering and developing medicines that make a meaningful difference to patients worldwide.",
        },
      ];

      const extractedContent =
        webSearchService.extractSearchContent(mockResults);

      expect(extractedContent).toBeDefined();
      expect(extractedContent.length).toBeGreaterThan(0);
      expect(extractedContent).toContain("AstraZeneca");
      expect(extractedContent).toContain("pharmaceutical");
    });
  });

  describe("AI Extraction Service", () => {
    it("should extract company mission from text content", async () => {
      if (!aiExtractionService) {
        console.log(
          "⏭️ Skipping AI extraction test - ANTHROPIC_API_KEY not set"
        );
        return;
      }

      const mockContent = {
        mission:
          "AstraZeneca - Leading Pharmaceutical Company\nAstraZeneca is a global pharmaceutical company focused on discovering and developing medicines that make a meaningful difference to patients worldwide.",
        product: "",
        jobs: "",
        news: "",
        contact: "",
      };

      const extractedData = await aiExtractionService.extractCompanyData(
        "AstraZeneca AB",
        mockContent
      );

      expect(extractedData).toBeDefined();

      if (extractedData.mission) {
        expect(extractedData.mission.mission).toBeDefined();
        expect(extractedData.mission.confidence).toBeGreaterThan(0);
        expect(extractedData.mission.confidence).toBeLessThanOrEqual(1);

        console.log(
          `Extracted mission: "${extractedData.mission.mission}" (confidence: ${extractedData.mission.confidence})`
        );
      }
    }, 15000); // 15 second timeout for AI calls
  });

  describe("Company Enrichment Service", () => {
    it("should enrich a company with complete information", async () => {
      if (!enrichmentService) {
        console.log("⏭️ Skipping enrichment test - API keys not set");
        return;
      }

      const companyNames = ["Spotify AB"];
      const enrichedCompanies = await enrichmentService.enrichCompanies(
        companyNames,
        "Stockholm",
        1
      );

      expect(enrichedCompanies).toBeDefined();
      expect(enrichedCompanies.length).toBe(1);

      const company = enrichedCompanies[0];
      expect(company.company_name).toBe("Spotify AB");

      // At least some information should be extracted
      const hasAnyInfo = !!(
        company.mission ||
        company.product_description ||
        company.website ||
        company.industry ||
        (company.job_ads && company.job_ads.length > 0) ||
        (company.news && company.news.length > 0)
      );

      expect(hasAnyInfo).toBe(true);

      // Log enrichment results for verification
      console.log("Enriched company data:", {
        name: company.company_name,
        mission: company.mission?.slice(0, 100) + "...",
        industry: company.industry,
        website: company.website,
        jobs: company.job_ads?.length || 0,
        news: company.news?.length || 0,
      });

      // Check enrichment stats
      const stats = enrichmentService.getEnrichmentStats(enrichedCompanies);
      expect(stats.total).toBe(1);

      console.log("Enrichment stats:", stats);
    }, 60000); // 60 second timeout for full enrichment
  });
});
