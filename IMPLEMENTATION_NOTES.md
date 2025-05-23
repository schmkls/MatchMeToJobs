## General

We are implementing a server/service, that searches the web for job based on params and description, and ranks them.

See IMPLEMENTATION_IMAGE.jpeg.

Implement as minmally, simply, and concise , use NodeJS, Typescript, Hono server.

Write tests for the allabolag scraping. Use playwright to verify tests are correct.

Use Vercel AI SDK, zod, gitignored .env file with anthropic key.

Use LLMs / Vercel AI SDK to lookup and find mission, product summary, website, recent news with links, job ads with links.

Reason about a good method of ranking companies based on summary.

Go step by step, begin with handling params, ask user for clarification/verification of implementation. Only when verified we should move on the the Allabolag lookup.

Use pre-existing and simple libraries instead of custom implementations if possible. Search the web for documentation and inspiration if needed.

## Notes so far

# MatchMeToJobs Implementation Notes

## Parameter Validation ✅ COMPLETE

- Implemented Zod schemas for all search parameters
- Revenue range: -2,213,349 to 192,505,000 SEK
- Profit range: -12,153,147 to 109,441,000 SEK
- Employee range: 0 to 100,000
- Location string validation
- Description validation (min 10 chars)
- Sort options: profitAsc, registrationDateDesc, numEmployeesAsc

## Allabolag Scraping ✅ COMPLETE

### Implementation Strategy

✅ **Precise Selector Approach**: After analyzing the website structure, identified that company names are reliably located in `h2 a[href*="/foretag/"]` elements.

### URL Parameter Mapping

- `revenueFrom` → `revenueFrom` (in thousands SEK)
- `revenueTo` → `revenueTo` (in thousands SEK)
- `profitFrom` → `profitFrom` (in thousands SEK)
- `profitTo` → `profitTo` (in thousands SEK)
- `numEmployeesFrom` → `numEmployeesFrom`
- `numEmployeesTo` → `numEmployeesTo`
- `location` → `location`
- `sort` → `sort` (revenueAsc, revenueDesc, profitAsc, registrationDateDesc, numEmployeesAsc)
- `page` → `page` (for pagination)
- `host` → `www.allabolag.se` (required parameter)

### Technical Implementation

- **Web Scraper**: Using Cheerio for HTML parsing
- **HTTP Client**: Built-in fetch with proper headers
- **Rate Limiting**: 1-second delay between requests
- **Error Handling**: Graceful failure with empty arrays
- **Pagination**: Configurable page limits (default: 3 pages)
- **Sorting**: Full support for all Allabolag sort options

### Testing ✅ VERIFIED

- **Integration tests** with real HTTP requests
- **AstraZeneca AB verification**: Confirmed as first result for Stockholm revenue search
- **Major Stockholm companies**: Successfully extracts Preem, Scania, H&M, Ericsson
- **Edge case handling**: Empty results and network errors handled gracefully

### Example Output

```
["AstraZeneca AB", "Preem Aktiebolag", "Scania CV Aktiebolag", "H & M Hennes & Mauritz GBC AB", "Ericsson AB", ...]
```

## Web Search & AI Extraction ✅ COMPLETE

### Implementation Strategy

✅ **Brave Search API Integration**: Uses Brave Search API with "Data for AI" plan for web search functionality
✅ **Parallel AI Processing**: Uses Claude 3 Haiku via Anthropic SDK for concurrent data extraction  
✅ **Structured Output**: Zod schemas ensure consistent, validated data extraction
✅ **Cost Control**: Limits to 10 companies and optimizes text extraction to reduce API costs

### Web Search Queries

- **Mission**: `"CompanyName" mission vision purpose company`
- **Product**: `"CompanyName" products services what does company do`
- **Jobs**: `jobb för "CompanyName" {location} site:linkedin.com OR site:jobs.se`

### AI Extraction Types

- **Mission**: Company mission/vision (returns "not found" if unavailable)
- **Product**: Product/service summary and business description
- **Jobs**: Job postings with URLs and platform information

### Data Pipeline

1. **Allabolag Scraping** → Company names list
2. **Web Search** → Raw search results for each company (3 search types × 3-5 results each)
3. **Content Extraction** → Text summarization (limited to 1500 chars per search type)
4. **AI Processing** → Parallel extraction using Claude (3 concurrent tasks per company)
5. **Structured Output** → Validated JSON objects via Zod schemas

### Rate Limiting & Performance

- **Web Search**: 1 second delay between search types
- **Company Processing**: 2 second delay between companies
- **Total Time**: ~20-30 seconds for 10 companies (3 searches + 3 AI extractions each)
- **API Costs**: ~$0.03-0.05 per company (Brave + Claude Haiku)

### Testing ✅ VERIFIED

- **Unit Tests**: Web search content extraction and schema validation
- **Integration Tests**: Real API calls to Brave Search and Anthropic
- **Error Handling**: Graceful failure with partial results
- **Environment**: Configurable API keys with health check endpoint

### API Response Structure

The API returns a structured response with success status, company data, statistics, and metadata:

```json
{
  "success": true,
  "message": "Found and enriched 10 companies",
  "companies": [
    {
      "company_name": "Arevo AB",
      "mission": "At Arevo, we believe that thriving crops and forests start from the ground up. Our precision nutrition technology enhances plants' natural ability to absorb nutrients and water while supporting beneficial soil microbes.",
      "product_summary": "Arevo AB is a Swedish company that conducts research and experimental development on natural sciences and engineering, with a focus on developing innovative solutions to help plants grow better and bind more carbon for a healthier planet.",
      "job_ads": [
        {
          "title": "Produktionstekniker",
          "url": "https://se.linkedin.com/jobs/view/produktionstekniker-at-arevo-ab-3255417651",
          "platform": "LinkedIn"
        }
      ]
    }
  ],
  "stats": {
    "total": 10,
    "withMission": 3,
    "withProduct": 10,
    "withJobs": 6,
    "withNews": 0
  },
  "metadata": {
    "allabolag_total": 20,
    "enriched_count": 10,
    "search_params": {
      "location": "Umeå",
      "numEmployeesFrom": 2,
      "numEmployeesTo": 15,
      "sort": "profitAsc",
      "description": "Hot dogs s s s s s s"
    }
  }
}
```

### Company Data Structure

Each company object contains:

- **company_name**: String - The company name from Allabolag
- **mission**: String - Company mission/vision or "not found"
- **product_summary**: String - Description of products/services and business focus
- **job_ads**: Array - Job postings (can be empty array)
  - **title**: String - Job title or summary
  - **url**: String - Direct link to job posting
  - **platform**: String - Source platform (LinkedIn, Company website, etc.)

### Response Metadata

- **stats**: Data availability statistics across all companies
- **metadata**: Search parameters and result counts from Allabolag
- **success**: Boolean indicating if the operation completed successfully
- **message**: Human-readable status message

## Next Steps

1. ⏳ **AI-Powered Job Matching & Ranking** - Use user description to rank companies by fit
2. ⏳ **Result Optimization** - Cache results, filter duplicates, improve search queries
3. ⏳ **Frontend Interface** - Simple web UI for testing and demonstration
