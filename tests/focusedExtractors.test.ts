import { describe, it, expect } from "vitest";
import { CompanyEnrichmentService } from "../src/services/companyEnrichmentService.js";
import { AIExtractionService } from "../src/services/aiExtractionService.js";
import { WebSearchService } from "../src/services/webSearchService.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

describe("Focused Extractors Integration Tests", () => {
  const braveApiKey = process.env.BRAVE_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  // Skip tests if API keys are not available
  const skipIfNoKeys = !braveApiKey || !anthropicApiKey;

  if (skipIfNoKeys) {
    console.log("⚠️  Skipping integration tests - missing API keys");
    console.log(
      "💡 Create .env file with BRAVE_API_KEY and ANTHROPIC_API_KEY to run tests"
    );
  }

  describe("Web Search Service", () => {
    it.skipIf(skipIfNoKeys)(
      "should search for AstraZeneca and find focused results",
      async () => {
        const webService = new WebSearchService(braveApiKey!);

        console.log("🔍 Testing web search for AstraZeneca...");
        const results = await webService.searchCompanyInfo("AstraZeneca");

        // Check all four search types returned data
        expect(results.mission).toBeDefined();
        expect(results.product).toBeDefined();
        expect(results.jobs).toBeDefined();
        expect(results.news).toBeDefined();

        console.log("📊 Search Results Summary:");
        console.log(`  Mission results: ${results.mission.length}`);
        console.log(`  Product results: ${results.product.length}`);
        console.log(`  Jobs results: ${results.jobs.length}`);
        console.log(`  News results: ${results.news.length}`);

        // Each search should return some results
        expect(results.mission.length).toBeGreaterThan(0);
        expect(results.product.length).toBeGreaterThan(0);
      },
      30000
    );
  });

  describe("AI Extraction Service", () => {
    it.skipIf(skipIfNoKeys)(
      "should extract focused data from search content",
      async () => {
        const aiService = new AIExtractionService(anthropicApiKey!);

        // Mock search content for testing
        const mockSearchContent = {
          mission: `
          URL: https://astrazeneca.com/about
          AstraZeneca - About Us
          AstraZeneca is a global, science-led pharmaceutical company that focuses on the discovery, development, and commercialisation of prescription medicines primarily for the treatment of diseases in three therapy areas - Oncology, Cardiovascular, Renal & Metabolism, and Respiratory & Immunology.
        `,
          product: `
          URL: https://astrazeneca.com/products
          AstraZeneca Products
          We develop and manufacture prescription medicines for serious diseases including cancer, cardiovascular disease, diabetes, and respiratory conditions. Our medicines help millions of patients worldwide.
        `,
          jobs: `
          URL: https://linkedin.com/jobs/astrazeneca
          Software Engineer at AstraZeneca - LinkedIn
          Join our team developing digital solutions for drug discovery. Located in Gothenburg, Sweden.
          
          URL: https://astrazeneca.com/careers/123
          Data Scientist - AstraZeneca
          Work with clinical trial data to accelerate drug development.
        `,
          news: `
          URL: https://reuters.com/astrazeneca-news-2024
          AstraZeneca Reports Strong Q4 Results - Reuters
          AstraZeneca announced strong quarterly results driven by oncology drug sales growth.
          
          URL: https://techcrunch.com/astrazeneca-ai-2024
          AstraZeneca Invests in AI Drug Discovery - TechCrunch  
          The pharmaceutical giant announced a new partnership with AI company to accelerate drug discovery.
        `,
        };

        console.log("🤖 Testing AI extraction...");
        const extracted = await aiService.extractCompanyData(
          "AstraZeneca",
          mockSearchContent
        );

        console.log("📋 Extraction Results:");
        console.log("Mission:", extracted.mission?.mission);
        console.log("Product:", extracted.product?.product_summary);
        console.log("Jobs found:", extracted.jobs?.job_ads?.length || 0);
        console.log("News found:", extracted.news?.recent_news?.length || 0);

        // Check that extraction worked
        expect(extracted.mission).toBeDefined();
        expect(extracted.product).toBeDefined();
        expect(extracted.jobs).toBeDefined();
        expect(extracted.news).toBeDefined();

        // Mission should not be "not found" for AstraZeneca
        if (extracted.mission?.mission) {
          expect(extracted.mission.mission).not.toBe("not found");
          expect(extracted.mission.mission.length).toBeGreaterThan(10);
        }

        // Product summary should be meaningful
        if (extracted.product?.product_summary) {
          expect(extracted.product.product_summary.length).toBeGreaterThan(10);
        }

        // Jobs should include URLs
        if (extracted.jobs?.job_ads) {
          extracted.jobs.job_ads.forEach((job) => {
            expect(job.url).toMatch(/^https?:\/\//);
            expect(job.title.length).toBeGreaterThan(0);
            expect(job.platform.length).toBeGreaterThan(0);
          });
        }

        // News should include URLs
        if (extracted.news?.recent_news) {
          extracted.news.recent_news.forEach((article) => {
            expect(article.url).toMatch(/^https?:\/\//);
            expect(article.title.length).toBeGreaterThan(0);
            expect(article.summary.length).toBeGreaterThan(0);
          });
        }
      },
      30000
    );
  });

  describe("Full Company Enrichment", () => {
    it.skipIf(skipIfNoKeys)(
      "should enrich AstraZeneca with focused extractors",
      async () => {
        const enrichmentService = new CompanyEnrichmentService(
          braveApiKey!,
          anthropicApiKey!
        );

        console.log("🚀 Testing full enrichment for AstraZeneca...");
        const results = await enrichmentService.enrichCompanies(
          ["AstraZeneca"],
          1
        );

        expect(results).toHaveLength(1);
        const company = results[0];

        console.log("🎯 Final Enrichment Results:");
        console.log("Company:", company.company_name);
        console.log("Mission:", company.mission || "not found");
        console.log("Product Summary:", company.product_summary || "not found");
        console.log("Jobs:", company.job_ads?.length || 0, "found");
        console.log("News:", company.recent_news?.length || 0, "found");

        // Get stats
        const stats = enrichmentService.getEnrichmentStats(results);
        console.log("📊 Enrichment Stats:", stats);

        expect(company.company_name).toBe("AstraZeneca");

        // Should have some enriched data (not all fields required to pass)
        const hasData =
          company.mission ||
          company.product_summary ||
          (company.job_ads && company.job_ads.length > 0) ||
          (company.recent_news && company.recent_news.length > 0);

        expect(hasData).toBeTruthy();
      },
      60000
    ); // Longer timeout for full integration
  });

  describe("Debug Individual Extractors", () => {
    it.skipIf(skipIfNoKeys)(
      "should test mission extractor individually",
      async () => {
        const aiService = new AIExtractionService(anthropicApiKey!);
        const webService = new WebSearchService(braveApiKey!);

        console.log("🔍 Testing mission extractor for IKEA...");

        // Get real search data
        const searchResults = await webService.searchCompanyInfo("IKEA");
        const missionContent = webService.extractSearchContent(
          searchResults.mission
        );

        console.log(
          "🔎 Mission search content:",
          missionContent.substring(0, 200) + "..."
        );

        // Test just mission extraction
        const extracted = await aiService.extractCompanyData("IKEA", {
          mission: missionContent,
          product: "",
          jobs: "",
          news: "",
        });

        console.log("🎯 Mission result:", extracted.mission?.mission);

        expect(extracted.mission).toBeDefined();
        if (extracted.mission?.mission) {
          expect(typeof extracted.mission.mission).toBe("string");
        }
      },
      30000
    );
  });
});
