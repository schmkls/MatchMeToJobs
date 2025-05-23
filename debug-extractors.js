#!/usr/bin/env node

import { CompanyEnrichmentService } from "./dist/services/companyEnrichmentService.js";
import { WebSearchService } from "./dist/services/webSearchService.js";
import { AIExtractionService } from "./dist/services/aiExtractionService.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!BRAVE_API_KEY || !ANTHROPIC_API_KEY) {
  console.error("❌ Missing API keys!");
  console.error("💡 Please create a .env file with:");
  console.error("   BRAVE_API_KEY=your_brave_api_key");
  console.error("   ANTHROPIC_API_KEY=your_anthropic_api_key");
  process.exit(1);
}

async function debugWebSearch(companyName) {
  console.log(`\n🔍 === DEBUGGING WEB SEARCH FOR: ${companyName} ===`);

  const webService = new WebSearchService(BRAVE_API_KEY);
  const results = await webService.searchCompanyInfo(companyName);

  console.log("\n📊 Web Search Results:");
  Object.entries(results).forEach(([type, searchResults]) => {
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  Found ${searchResults.length} results`);

    if (searchResults.length > 0) {
      searchResults.slice(0, 2).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title}`);
        console.log(`     URL: ${result.url}`);
        console.log(
          `     Description: ${result.description.substring(0, 100)}...`
        );
      });
    }
  });

  return results;
}

async function debugAIExtraction(companyName, searchResults) {
  console.log(`\n🤖 === DEBUGGING AI EXTRACTION FOR: ${companyName} ===`);

  const webService = new WebSearchService(BRAVE_API_KEY);
  const aiService = new AIExtractionService(ANTHROPIC_API_KEY);

  // Extract content for AI
  const searchContent = {
    mission: webService.extractSearchContent(searchResults.mission),
    product: webService.extractSearchContent(searchResults.product),
    jobs: webService.extractSearchContent(searchResults.jobs),
    news: webService.extractSearchContent(searchResults.news),
  };

  console.log("\n📄 Extracted Content for AI:");
  Object.entries(searchContent).forEach(([type, content]) => {
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  Length: ${content.length} characters`);
    console.log(
      `  Content: ${content.substring(0, 150)}${
        content.length > 150 ? "..." : ""
      }`
    );
  });

  // Perform AI extraction
  console.log("\n🧠 Running AI extraction...");
  const extracted = await aiService.extractCompanyData(
    companyName,
    searchContent
  );

  console.log("\n✨ AI Extraction Results:");
  console.log("\n📋 MISSION:");
  console.log(`  ${extracted.mission?.mission || "No mission found"}`);

  console.log("\n🏭 PRODUCT SUMMARY:");
  console.log(
    `  ${extracted.product?.product_summary || "No product info found"}`
  );

  console.log("\n💼 JOBS:");
  if (extracted.jobs?.job_ads && extracted.jobs.job_ads.length > 0) {
    extracted.jobs.job_ads.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.title}`);
      console.log(`     Platform: ${job.platform}`);
      console.log(`     URL: ${job.url}`);
    });
  } else {
    console.log("  No jobs found");
  }

  console.log("\n📰 NEWS:");
  if (extracted.news?.recent_news && extracted.news.recent_news.length > 0) {
    extracted.news.recent_news.forEach((article, index) => {
      console.log(`  ${index + 1}. ${article.title}`);
      console.log(`     Summary: ${article.summary}`);
      console.log(`     URL: ${article.url}`);
    });
  } else {
    console.log("  No news found");
  }

  return extracted;
}

async function debugFullEnrichment(companyName) {
  console.log(`\n🚀 === DEBUGGING FULL ENRICHMENT FOR: ${companyName} ===`);

  const enrichmentService = new CompanyEnrichmentService(
    BRAVE_API_KEY,
    ANTHROPIC_API_KEY
  );
  const results = await enrichmentService.enrichCompanies([companyName], 1);

  if (results.length > 0) {
    const company = results[0];
    console.log("\n🎯 Final Enriched Company Data:");
    console.log(`  Company: ${company.company_name}`);
    console.log(`  Mission: ${company.mission || "Not found"}`);
    console.log(`  Product: ${company.product_summary || "Not found"}`);
    console.log(`  Jobs: ${company.job_ads?.length || 0} found`);
    console.log(`  News: ${company.recent_news?.length || 0} found`);

    const stats = enrichmentService.getEnrichmentStats(results);
    console.log("\n📊 Enrichment Statistics:");
    console.log(`  Total: ${stats.total}`);
    console.log(`  With Mission: ${stats.withMission}`);
    console.log(`  With Product: ${stats.withProduct}`);
    console.log(`  With Jobs: ${stats.withJobs}`);
    console.log(`  With News: ${stats.withNews}`);
  }

  return results;
}

async function main() {
  // Get company name from command line args or use default
  const companyName = process.argv[2] || "AstraZeneca";
  const debugMode = process.argv[3] || "all"; // all, web, ai, full

  console.log(`🎯 Debug mode: ${debugMode}`);
  console.log(`🏢 Company: ${companyName}`);

  try {
    switch (debugMode) {
      case "web":
        await debugWebSearch(companyName);
        break;

      case "ai":
        const searchResults = await debugWebSearch(companyName);
        await debugAIExtraction(companyName, searchResults);
        break;

      case "full":
        await debugFullEnrichment(companyName);
        break;

      default: // 'all'
        const webResults = await debugWebSearch(companyName);
        await debugAIExtraction(companyName, webResults);
        await debugFullEnrichment(companyName);
        break;
    }

    console.log("\n✅ Debug completed successfully!");
  } catch (error) {
    console.error("\n❌ Debug failed:", error);
    console.error("\nStack trace:", error.stack);
  }
}

// Usage examples:
console.log("📖 Usage examples:");
console.log(
  "  node debug-extractors.js                    # Debug AstraZeneca (all modes)"
);
console.log(
  "  node debug-extractors.js IKEA              # Debug IKEA (all modes)"
);
console.log(
  "  node debug-extractors.js IKEA web          # Debug IKEA (web search only)"
);
console.log(
  "  node debug-extractors.js IKEA ai           # Debug IKEA (web + AI extraction)"
);
console.log(
  "  node debug-extractors.js IKEA full         # Debug IKEA (full enrichment)"
);
console.log("");

main().catch(console.error);
