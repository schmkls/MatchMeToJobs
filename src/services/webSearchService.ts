interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  date?: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
  news?: {
    results: BraveSearchResult[];
  };
}

export interface SearchQuery {
  query: string;
  type: "mission" | "product" | "jobs" | "news";
  maxResults?: number;
}

export class WebSearchService {
  private apiKey: string;
  private baseUrl = "https://api.search.brave.com/res/v1";
  private delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search for company information using focused strategies
   */
  async searchCompanyInfo(companyName: string): Promise<{
    mission: BraveSearchResult[];
    product: BraveSearchResult[];
    jobs: BraveSearchResult[];
    news: BraveSearchResult[];
  }> {
    console.log(`🔍 Starting focused web search for: ${companyName}`);

    // Define focused search queries for the four key areas
    const queries: SearchQuery[] = [
      {
        query: `"${companyName}" mission vision purpose company about`,
        type: "mission",
        maxResults: 3,
      },
      {
        query: `"${companyName}" products services what company does business`,
        type: "product",
        maxResults: 3,
      },
      {
        query: `"${companyName}" jobs careers hiring linkedin.com`,
        type: "jobs",
        maxResults: 5,
      },
      {
        query: `"${companyName}" news recent 2024 2025`,
        type: "news",
        maxResults: 3,
      },
    ];

    const results: {
      mission: BraveSearchResult[];
      product: BraveSearchResult[];
      jobs: BraveSearchResult[];
      news: BraveSearchResult[];
    } = {
      mission: [],
      product: [],
      jobs: [],
      news: [],
    };

    // Execute searches with delays to respect rate limits
    for (const searchQuery of queries) {
      try {
        console.log(`  🔎 Searching for ${searchQuery.type}`);

        const searchResults = await this.performSearch(searchQuery);
        results[searchQuery.type] = searchResults;

        // Add delay between requests
        await this.delay(1000); // 1 second delay
      } catch (error) {
        console.error(`❌ Error searching for ${searchQuery.type}:`, error);
        // Continue with other searches even if one fails
      }
    }

    console.log(`🎯 Completed web search for: ${companyName}`);
    return results;
  }

  /**
   * Perform a single search using Brave Search API
   */
  private async performSearch(
    searchQuery: SearchQuery
  ): Promise<BraveSearchResult[]> {
    const isNewsSearch = searchQuery.type === "news";
    const endpoint = isNewsSearch ? "/news/search" : "/web/search";
    const url = `${this.baseUrl}${endpoint}`;

    const params = new URLSearchParams({
      q: searchQuery.query,
      country: "SE", // Sweden for Swedish companies
      search_lang: "en", // English results for better AI processing
      result_lang: "en", // English results
      count: (searchQuery.maxResults || 3).toString(),
      offset: "0",
    });

    try {
      const response = await fetch(`${url}?${params}`, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Brave Search API error: ${response.status} ${response.statusText}`
        );
      }

      const data: BraveSearchResponse = await response.json();

      // Extract results based on search type
      const results = isNewsSearch
        ? data.news?.results || []
        : data.web?.results || [];

      console.log(
        `    📊 Found ${results.length} results for ${searchQuery.type}`
      );
      return results;
    } catch (error) {
      console.error(`Failed to search for ${searchQuery.type}:`, error);
      return [];
    }
  }

  /**
   * Extract text content from search results for AI processing
   * Optimized for the focused extractors
   */
  extractSearchContent(results: BraveSearchResult[]): string {
    return results
      .map((result) => {
        // Include URL for link extraction in jobs and news
        const urlInfo = result.url ? `URL: ${result.url}\n` : "";
        const content = `${urlInfo}${result.title}\n${result.description}`;
        return content.slice(0, 400); // Increased limit for better context
      })
      .join("\n\n")
      .slice(0, 2000); // Increased total limit for focused extractors
  }
}
