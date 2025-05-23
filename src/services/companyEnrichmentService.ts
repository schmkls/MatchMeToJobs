import { WebSearchService } from "./webSearchService.js";
import { AIExtractionService } from "./aiExtractionService.js";
import type { EnrichedCompany } from "../schemas/companyData.js";

export class CompanyEnrichmentService {
  private webSearchService: WebSearchService;
  private aiExtractionService: AIExtractionService;

  constructor(braveApiKey: string, anthropicApiKey: string) {
    this.webSearchService = new WebSearchService(braveApiKey);
    this.aiExtractionService = new AIExtractionService(anthropicApiKey);
  }

  /**
   * Enrich a list of company names with detailed information using focused extractors
   */
  async enrichCompanies(
    companyNames: string[],
    maxCompanies: number = 10
  ): Promise<EnrichedCompany[]> {
    const companiesToProcess = companyNames.slice(0, maxCompanies);
    console.log(
      `🚀 Enriching ${companiesToProcess.length} companies (limited from ${companyNames.length})`
    );

    const enrichedCompanies: EnrichedCompany[] = [];

    for (const companyName of companiesToProcess) {
      try {
        console.log(`\n🔍 Processing: ${companyName}`);

        const enrichedCompany = await this.enrichSingleCompany(companyName);
        if (enrichedCompany) {
          enrichedCompanies.push(enrichedCompany);
        }

        // Add delay between companies to respect rate limits
        await this.delay(2000); // 2 second delay between companies
      } catch (error) {
        console.error(`❌ Failed to enrich ${companyName}:`, error);
        // Continue with other companies even if one fails
        enrichedCompanies.push({
          company_name: companyName,
        });
      }
    }

    return enrichedCompanies;
  }

  /**
   * Enrich a single company with web search and focused AI extraction
   */
  private async enrichSingleCompany(
    companyName: string
  ): Promise<EnrichedCompany | null> {
    console.log(`  🌐 Searching web for: ${companyName}`);

    // Step 1: Perform focused web searches
    const searchResults = await this.webSearchService.searchCompanyInfo(
      companyName
    );

    // Step 2: Extract text content for AI processing
    const searchContent = {
      mission: this.webSearchService.extractSearchContent(
        searchResults.mission
      ),
      product: this.webSearchService.extractSearchContent(
        searchResults.product
      ),
      jobs: this.webSearchService.extractSearchContent(searchResults.jobs),
      news: this.webSearchService.extractSearchContent(searchResults.news),
    };

    console.log(`  🤖 Extracting structured data with focused extractors`);

    // Step 3: Use focused AI extractors
    const extractedData = await this.aiExtractionService.extractCompanyData(
      companyName,
      searchContent
    );

    // Step 4: Combine all data into enriched company object
    const enrichedCompany: EnrichedCompany = {
      company_name: companyName,
      mission: extractedData.mission?.mission,
      product_summary: extractedData.product?.product_summary,
      job_ads: extractedData.jobs?.job_ads,
      recent_news: extractedData.news?.recent_news,
    };

    console.log(`  ✅ Enriched: ${companyName}`);

    return enrichedCompany;
  }

  /**
   * Get summary statistics about the enrichment results
   */
  getEnrichmentStats(companies: EnrichedCompany[]): {
    total: number;
    withMission: number;
    withProduct: number;
    withJobs: number;
    withNews: number;
  } {
    return {
      total: companies.length,
      withMission: companies.filter(
        (c) => c.mission && c.mission !== "not found"
      ).length,
      withProduct: companies.filter((c) => c.product_summary).length,
      withJobs: companies.filter((c) => c.job_ads && c.job_ads.length > 0)
        .length,
      withNews: companies.filter(
        (c) => c.recent_news && c.recent_news.length > 0
      ).length,
    };
  }

  private delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
}
