## General

We are implementing a server/service, that searches the web for job based on params and description, and ranks them.

See IMPLEMENTATION_IMAGE.jpeg.

Implement as minmally, simply, and concise , use NodeJS, Typescript, Hono server.

Write tests for the allabolag scraping. Use playwright to verify tests are correct.

Use Vercel AI SDK, zod, gitignored .env file with anthropic key.

Use LLMs / Vercel AI SDK to lookup and find mission, product summary, website, recent news with links, job ads with links.

Reason about a good method of ranking companies based on summary.

Use pre-existing and simple libraries instead of custom implementations if possible. Search the web for documentation and inspiration if needed. Prioritize already installed libraries and fewer dependencies, but reason about pros and cons.

Please ask the user for clarifications and verifications to gain information before implementation.

## Notes so far

# MatchMeToJobs Implementation Notes

## Parameter Validation ✅ COMPLETE

- Implemented Zod schemas for all search parameters
- Revenue range: -2,213,349 to 192,505,000 SEK
- Profit range: -12,153,147 to 109,441,000 SEK
- Employee range: 0 to 100,000
- Location string validation
- Description validation (min 10 chars)
- **NEW**: Industry description validation (5-500 chars, optional)
- Sort options: profitAsc, registrationDateDesc, numEmployeesAsc

## Industry Code Matching ✅ COMPLETE

### Overview

Converts user-friendly industry descriptions (e.g., "software development") into Swedish `proffIndustryCode` values for precise Allabolag searches.

### Implementation Strategy

✅ **Fast Semantic Similarity**: Text-based matching against 645 enriched Swedish industry codes
✅ **AI Refinement**: Optional Claude-powered refinement for ambiguous cases
✅ **URL Integration**: Automatic parameter injection into Allabolag searches

### Data Sources

- **Industry Codes**: 645 Swedish industry codes extracted from Allabolag
- **Enriched Data**: English descriptions and keywords added via AI enrichment
- **File**: `src/data/enrichedIndustryCodes.json`

### Technical Process

1. **Text Similarity Scoring** (~100ms):

   - Exact phrase matching (weight 1.0)
   - Word overlap scoring (weight 0.8)
   - Keyword matching (weight 0.3)
   - Description relevance (weight 0.5)

2. **Candidate Filtering**:

   - Filter similarity > 0.1
   - Top 15 candidates for AI review

3. **AI Refinement** (~1 second, optional):

   - Claude 3 Haiku semantic analysis
   - Only for ambiguous cases (many candidates)
   - Returns 1-8 most relevant codes

4. **URL Parameter**:
   - Format: `&proffIndustryCode=10002115%2C10002102%2C10002017`
   - Automatically added to Allabolag searches

### Performance

- **Total Time**: ~100ms (text similarity) + ~1s (optional AI)
- **Accuracy**: High semantic understanding with Swedish industry context
- **Fallback**: Text similarity if AI fails

### Example Mappings

```
"software development" → ["10002115", "10002102", "10002017"]
"web development" → ["10004496", "10002115", "10002383"]
"restaurants" → ["10006755", "10241591", "10006767"]
"construction" → ["10001729", "10001708", "10000708"]
"healthcare" → ["10008653", "10008612", "10008651"]
```

### API Integration

- **Parameter**: `industryDescription` (optional, 5-500 chars)
- **Response**: `metadata.industry_codes` array shows matched codes
- **Auto-filtering**: Companies automatically filtered by industry

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
- **NEW**: `proffIndustryCode` → Industry filtering (comma-separated codes)

### Technical Implementation

- **Web Scraper**: Using Cheerio for HTML parsing
- **HTTP Client**: Built-in fetch with proper headers
- **Rate Limiting**: 1-second delay between requests
- **Error Handling**: Graceful failure with empty arrays
- **Pagination**: Configurable page limits (default: 2 pages for performance)
- **Sorting**: Full support for all Allabolag sort options
- **Industry Filtering**: Automatic integration with matched industry codes

### Testing ✅ VERIFIED

- **Integration tests** with real HTTP requests
- **AstraZeneca AB verification**: Confirmed as first result for Stockholm revenue search
- **Major Stockholm companies**: Successfully extracts Preem, Scania, H&M, Ericsson
- **Industry filtering**: Verified with software development and restaurant queries
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

1. **Industry Matching** → Convert description to Swedish industry codes (optional)
2. **Allabolag Scraping** → Company names list (with industry filtering)
3. **Web Search** → Raw search results for each company (3 search types × 3-5 results each)
4. **Content Extraction** → Text summarization (limited to 1500 chars per search type)
5. **AI Processing** → Parallel extraction using Claude (3 concurrent tasks per company)
6. **Structured Output** → Validated JSON objects via Zod schemas

### Rate Limiting & Performance

- **Industry Matching**: ~100ms for text similarity + ~1s for AI refinement
- **Web Search**: 1 second delay between search types
- **Company Processing**: 2 second delay between companies
- **Total Time**: ~20-30 seconds for 10 companies (3 searches + 3 AI extractions each)
- **API Costs**: ~$0.03-0.05 per company (Brave + Claude Haiku)

### Testing ✅ VERIFIED

- **Unit Tests**: Web search content extraction and schema validation
- **Integration Tests**: Real API calls to Brave Search and Anthropic
- **Industry Integration**: End-to-end testing with industryDescription parameter
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
      "location": "Stockholm",
      "industryDescription": "software development",
      "description": "Looking for software development opportunities"
    },
    "industry_codes": ["10002115", "10002102", "10002017"]
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
- **industry_codes**: Array of matched Swedish industry codes (NEW)
- **success**: Boolean indicating if the operation completed successfully
- **message**: Human-readable status message

## API Documentation ✅ COMPLETE

### Main Endpoint: `POST /api/jobs/search`

**Required Parameters:**

- `description`: string (10-1000 chars) - Job description/what you're looking for

**Optional Parameters:**

- `location`: string - Location to search (e.g., "Stockholm", "Göteborg")
- `industryDescription`: string (5-500 chars) - **NEW** Industry type (e.g., "software development", "healthcare")
- `revenueFrom/revenueTo`: number - Company revenue range in SEK
- `profitFrom/profitTo`: number - Company profit range in SEK
- `numEmployeesFrom/numEmployeesTo`: number - Company size range
- `sort`: enum - Sort order (profitAsc, revenueDesc, etc.)

**Example Request:**

```json
{
  "description": "Looking for software development opportunities",
  "location": "Stockholm",
  "industryDescription": "software development",
  "revenueFrom": 1000000
}
```

**Health Check:** `GET /api/jobs/health`

### Environment Variables Required

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
BRAVE_API_KEY=your_brave_search_api_key_here
PORT=4000
```

## File Structure

### Core Services

- `src/services/industryMatchingService.ts` - **NEW** Industry code matching
- `src/services/allabolagScraper.ts` - Company search with industry filtering
- `src/services/companyEnrichmentService.ts` - Web search + AI extraction

### Data Files

- `src/data/enrichedIndustryCodes.json` - **NEW** 645 Swedish industry codes with English descriptions
- `src/schemas/jobSearch.ts` - Parameter validation (updated with industryDescription)

### API Routes

- `src/routes/jobSearch.ts` - Main endpoints with full documentation
- `src/index.ts` - Server setup with API documentation

## Next Steps

1. ⏳ **AI-Powered Job Matching & Ranking** - Use user description to rank companies by fit. Reason about good methods.
2. ⏳ **Result Optimization** - Cache results, filter duplicates, improve search queries.
3. ⏳ **Frontend Interface** - Simple web UI for testing and demonstration. Support showing results and filtering list based on best description match, product match, has job ads, etc.
