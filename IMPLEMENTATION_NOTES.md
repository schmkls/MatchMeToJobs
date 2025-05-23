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
- **News**: `"CompanyName" news recent latest 2024 2025`
- **Contact**: `"CompanyName" website contact headquarters address`

### AI Extraction Types

- **Mission**: Company mission/vision with confidence score
- **Product**: Product description and industry classification
- **Jobs**: Up to 5 job postings with URLs and descriptions
- **News**: Up to 3 recent news articles with summaries
- **Contact**: Website, headquarters, founding year, employee count

### Data Pipeline

1. **Allabolag Scraping** → Company names list
2. **Web Search** → Raw search results for each company (5 search types × 3-5 results each)
3. **Content Extraction** → Text summarization (limited to 1500 chars per search type)
4. **AI Processing** → Parallel extraction using Claude (5 concurrent tasks per company)
5. **Structured Output** → Validated JSON objects via Zod schemas

### Rate Limiting & Performance

- **Web Search**: 1 second delay between search types
- **Company Processing**: 2 second delay between companies
- **Total Time**: ~30-40 seconds for 10 companies (5 searches + 5 AI extractions each)
- **API Costs**: ~$0.05-0.10 per company (Brave + Claude Haiku)

### Testing ✅ VERIFIED

- **Unit Tests**: Web search content extraction and schema validation
- **Integration Tests**: Real API calls to Brave Search and Anthropic
- **Error Handling**: Graceful failure with partial results
- **Environment**: Configurable API keys with health check endpoint

### Example Output Structure

```json
{
  "company_name": "Spotify AB",
  "mission": "To unlock the potential of human creativity",
  "product_description": "Music streaming platform and audio content",
  "industry": "Music Technology",
  "website": "https://spotify.com",
  "headquarters": "Stockholm, Sweden",
  "founded": "2006",
  "employee_count": "6000+",
  "job_ads": [
    {
      "title": "Senior Software Engineer",
      "url": "https://linkedin.com/jobs/...",
      "platform": "LinkedIn",
      "location": "Stockholm",
      "summary": "Backend development role..."
    }
  ],
  "news": [
    {
      "title": "Spotify Reports Q4 Growth",
      "url": "https://techcrunch.com/...",
      "date": "2024-02-01",
      "source": "TechCrunch",
      "summary": "Spotify reported strong growth..."
    }
  ]
}
```

## Next Steps

1. ⏳ **AI-Powered Job Matching & Ranking** - Use user description to rank companies by fit
2. ⏳ **Result Optimization** - Cache results, filter duplicates, improve search queries
3. ⏳ **Frontend Interface** - Simple web UI for testing and demonstration
