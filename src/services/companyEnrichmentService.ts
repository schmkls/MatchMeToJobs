import { OpenAIService } from "./OpenAIService.js";
import type { EnrichedCompany } from "../schemas/companyData.js";

export class CompanyEnrichmentService {
  private openAIService: OpenAIService;

  constructor(openaiApiKey: string) {
    if (!openaiApiKey) {
      // It's good practice to check for the key here as well,
      // though OpenAIService also checks it.
      throw new Error(
        "OpenAI API key is required for CompanyEnrichmentService."
      );
    }
    this.openAIService = new OpenAIService(openaiApiKey);
  }

  /**
   * Enrich a single company using OpenAI to get mission and product summary.
   * Location parameter is removed as per new requirements.
   */
  public async enrichSingleCompany(
    companyName: string
  ): Promise<EnrichedCompany | null> {
    if (!companyName || companyName.trim() === "") {
      console.warn(
        "[CompanyEnrichmentService] Company name is empty, cannot enrich."
      );
      return null;
    }

    console.log(
      `[CompanyEnrichmentService] Starting OpenAI enrichment for: ${companyName}`
    );

    try {
      const companyInfo = await this.openAIService.getCompanyInfo(companyName);

      if (!companyInfo.mission && !companyInfo.product) {
        console.warn(
          `[CompanyEnrichmentService] No information found by OpenAI for ${companyName}`
        );
        // Return an object with company name but no mission/product,
        // or null, depending on desired behavior for "not found entirely"
        return {
          company_name: companyName,
          // mission and product will be undefined by default
        };
      }

      const enrichedCompany: EnrichedCompany = {
        company_name: companyName,
        mission: companyInfo.mission, // Will be undefined if not found
        product_summary: companyInfo.product, // Will be undefined if not found
      };

      console.log(
        `[CompanyEnrichmentService] Enrichment complete for: ${companyName}`
      );
      return enrichedCompany;
    } catch (error) {
      console.error(
        `[CompanyEnrichmentService] Failed to enrich ${companyName} using OpenAI:`,
        error
      );
      // According to "let it crash" philosophy, we might re-throw or throw a new specific error.
      // However, the previous logic would return a minimal company object or null.
      // For now, returning a minimal object to align with previous partial success handling.
      // This could be changed to throw error; if so, the route handler needs to manage it.
      return {
        company_name: companyName,
        // mission and product_summary will be implicitly undefined
      };
    }
  }

  // enrichCompanies method is removed as the endpoint is for a single company.
  // getEnrichmentStats method is removed as job_ads are gone and stats are simplified.
  // private delay method is removed as it's no longer used.
}
