import * as cheerio from "cheerio";
import type { JobSearchParams } from "../types/index.js";

export class AllabolagScraper {
  private baseUrl = "https://www.allabolag.se/segmentering";
  private delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Search for companies on Allabolag using URL parameters
   * Returns only company names
   */
  async searchCompanies(
    params: JobSearchParams,
    maxPages: number = 3,
    industryCodes?: string[]
  ): Promise<string[]> {
    const companies: string[] = [];

    try {
      for (let page = 1; page <= maxPages; page++) {
        console.log(`Fetching Allabolag page ${page}...`);

        const url = this.buildUrl(params, page, industryCodes);
        const pageCompanies = await this.scrapePage(url);

        companies.push(...pageCompanies);

        // Add delay to be respectful to the server
        if (page < maxPages) {
          await this.delay(1000); // 1 second delay
        }
      }

      console.log(
        `Scraped ${companies.length} companies from ${maxPages} pages`
      );
      return companies;
    } catch (error) {
      console.error("Error scraping Allabolag:", error);
      throw new Error("Failed to scrape Allabolag data");
    }
  }

  /**
   * Build URL with query parameters based on search criteria
   */
  private buildUrl(
    params: JobSearchParams,
    page: number = 1,
    industryCodes?: string[]
  ): string {
    const url = new URL(this.baseUrl);

    // Always add host parameter (observed in actual URLs)
    url.searchParams.set("host", "www.allabolag.se");

    // Add revenue parameters
    if (params.revenueFrom !== undefined) {
      url.searchParams.set("revenueFrom", params.revenueFrom.toString());
    }
    if (params.revenueTo !== undefined) {
      url.searchParams.set("revenueTo", params.revenueTo.toString());
    }

    // Add profit parameters
    if (params.profitFrom !== undefined) {
      url.searchParams.set("profitFrom", params.profitFrom.toString());
    }
    if (params.profitTo !== undefined) {
      url.searchParams.set("profitTo", params.profitTo.toString());
    }

    // Add employee parameters
    if (params.numEmployeesFrom !== undefined) {
      url.searchParams.set(
        "numEmployeesFrom",
        params.numEmployeesFrom.toString()
      );
    }
    if (params.numEmployeesTo !== undefined) {
      url.searchParams.set("numEmployeesTo", params.numEmployeesTo.toString());
    }

    // Add location parameter (this might need different handling)
    if (params.location) {
      url.searchParams.set("location", params.location);
    }

    // Add sort parameter
    if (params.sort) {
      url.searchParams.set("sort", params.sort);
    }

    // Add industry codes parameter
    if (industryCodes && industryCodes.length > 0) {
      const formattedCodes = industryCodes.join(",");
      url.searchParams.set("proffIndustryCode", formattedCodes);
      console.log(`🏭 Using industry codes: ${industryCodes.join(", ")}`);
    }

    // Add pagination
    if (page > 1) {
      url.searchParams.set("page", page.toString());
    }

    console.log(`Built URL: ${url.toString()}`);
    return url.toString();
  }

  private async scrapePage(url: string): Promise<string[]> {
    try {
      // Use fetch to get the HTML
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const companies: string[] = [];

      // Extract company names from H2 > A elements
      // Based on analysis: company names are in h2 headings that contain links
      $('h2 a[href*="/foretag/"]').each((index, element) => {
        const companyName = $(element).text().trim();
        if (companyName) {
          companies.push(companyName);
        }
      });

      console.log(`Found ${companies.length} companies on this page`);
      return companies;
    } catch (error) {
      console.error(`Error scraping page ${url}:`, error);
      return [];
    }
  }
}
