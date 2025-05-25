# Implementation Notes

This document outlines the implementation details and plan for the MatchMeToJobs project. The project aims to provide a service for searching companies and, in the future, job listings, and then enriching this data.

## Current Refactoring Plan (Following SPECIFICATION.png)

We are currently refactoring the API to align with the structure defined in `SPECIFICATION.png`. This involves separating the company search and enrichment functionalities into distinct endpoints.

### Key Changes:

1.  **Separation of Concerns:**
    - `api/companies/search`: Will _only_ use Allabolag segmentation scraping to find companies based on specified criteria (revenue, location, profit, employee count, sort order). It will return a list of company names.
    - `api/companies/enrich`: A new endpoint dedicated to enriching a single company. It will take a company name and location, search the web, and extract/return the company's mission and product summary.
2.  **User Flow:** The new structure supports a two-step process:
    - User searches for companies.
    - User selects a company from the search results to view enriched details.
3.  **Development Philosophy:**
    - **No Fallback Methods:** Prioritize clear error handling over complex fallback mechanisms. If a process fails, it should crash, and we will address the root cause.
    - **No Backwards Compatibility:** The refactoring will not maintain compatibility with the old API structure.
    - **Service Reuse and Restructuring:** Existing services will be reused, restructured, or rewritten as needed to support the new endpoints.

### Endpoints (as per SPECIFICATION.png):

- **`api/companies/search`**

  - **Description:** Uses Allabolag segmentation scraping to find companies.
  - **Params:**
    - `revenueFrom`, `revenueTo`
    - `location` (string)
    - `profitFrom`, `profitTo`
    - `numEmployeesFrom`, `numEmployeesTo`
    - `sort` ∈ {`profitAsc`, `profitDesc`, `registrationDateDesc`, `numEmployeesAsc`, `numEmployeesDesc`}
  - **Example Response:** `{["Spotify AB", "GeoGuessr AB", "Anyfin AB"]}`

- **`api/companies/enrich`**
  - **Description:** Enriches a company by searching the web and extracting its mission and product summary.
  - **Params:**
    - `companyName`
    - `location`
  - **Example Response:** `{"product": "One of the worlds largest music, podcast and audio streaming services", "mission": "Our mission is to unlock the potential of human creativity—by giving a million creative artists the opportunity to live off their art and billions of fans the opportunity to enjoy and be inspired by it."}`

### Future Endpoints (Not part of the current refactoring sprint):

- `api/companies/jobs`
- `api/companies/score`

### Underlying Services (to be adapted/created):

- Allabolag.se Segmentation Scraping
- Company Enrichment (web search and extraction)
- Extractors (LLM-based for mission, product description, etc.)
- Company Job Ads Lookup (IMPLEMENT LATER)
- Allabolag.se Single Company Enrichment (IMPLEMENT LATER)
- General Job Ads Lookup (IMPLEMENT LATER)

---

## Previous Notes (To be reviewed and updated/removed as refactoring progresses)

## General

We are implementing a server/service that searches for companies and provides ranking capabilities for jobs and companies.

See IMPLEMENTATION_IMAGE.jpeg for the complete flow diagram.

Implemented using NodeJS, TypeScript, Hono server with minimal dependencies.
Uses AI SDK (OpenAI + Anthropic), Zod validation, and gitignored .env file.

## API Endpoints Overview

The system provides three main endpoints:

1. **Company Search** (`POST /api/companies/search`) - Search and enrich Swedish companies ✅ COMPLETE
2. **Job Ranking** (`POST /api/jobs/rank`) - Rank jobs against job description ⏳ TODO
3. **Company Ranking** (`POST /api/companies/rank`) - Rank companies against company description ⏳ TODO

## Implementation Status

### 1. Company Search Endpoint ✅ COMPLETE

**Endpoint**: `POST /api/companies/search`
**Health Check**: `GET /api/companies/health`
**Route**: `src/routes/companySearch.ts`

**Purpose**: Search for Swedish companies using Allabolag scraping with enriched company data from web search and AI extraction.

**Required Parameters**:

- `description`: string (10-1000 chars) - What type of companies you're looking for

**Optional Parameters**:

- `location`: string - Search location (e.g., "Stockholm", "Göteborg")
- `industryDescription`: string (5-500 chars) - Industry type (auto-matched to Swedish codes)
- `revenueFrom/To`, `profitFrom/To`, `numEmployeesFrom/To`: number ranges
- `sort`: enum - Sort order (profitAsc, profitDesc, registrationDateDesc, etc.)

**Response Structure**:

```json
{
  "success": true,
  "message": "Found and enriched X companies",
  "companies": [
    {
      "company_name": "Company Name",
      "mission": "Company mission statement or 'not found'",
      "product_summary": "What the company does/sells",
      "job_ads": [
        {
          "title": "Job Title",
          "url": "https://linkedin.com/...",
          "platform": "LinkedIn"
        }
      ]
    }
  ],
  "stats": {
    "total": 10,
    "withMission": 3,
    "withProduct": 10,
    "withJobs": 6
  },
  "metadata": {
    "allabolag_total": 20,
    "enriched_count": 10,
    "search_params": {...},
    "industry_codes": ["10002115", "10002102"]
  }
}
```

### 2. Job Ranking Endpoint ⏳ TODO

**Endpoint**: `POST /api/jobs/rank`
**Purpose**: Rank specific jobs against a job description for match scoring.

**Planned Parameters**:

- `jobDescription`: string - The job description to match against
- `jobs`: array - List of job objects to rank
  - Each job should include: `title`, `description`, `company_name`, `url`

**Planned Response**:

```json
{
  "success": true,
  "ranked_jobs": [
    {
      "job": {
        /* original job object */
      },
      "match_score": 0.85,
      "match_reasons": ["Skills alignment", "Industry match"],
      "rank": 1
    }
  ]
}
```

### 3. Company Ranking Endpoint ⏳ TODO

**Endpoint**: `POST /api/companies/rank`
**Purpose**: Rank companies against a company description for match scoring.

**Planned Parameters**:

- `companyDescription`: string - The company description/criteria to match against
- `companies`: array - List of enriched company objects to rank
  - Should include: `company_name`, `mission`, `product_summary`, `numEmployees`, `revenue`, `registrationYear`

**Planned Response**:

```json
{
  "success": true,
  "ranked_companies": [
    {
      "company": {
        /* original company object */
      },
      "match_score": 0.92,
      "match_reasons": [
        "Mission alignment",
        "Company size match",
        "Industry fit"
      ],
      "rank": 1
    }
  ]
}
```

## Core Components (Implemented)

### Parameter Validation ✅ COMPLETE

- Zod schemas for all search parameters in `src/schemas/jobSearch.ts`
- Revenue range: -2,213,349 to 192,505,000 SEK
- Profit range: -12,153,147 to 109,441,000 SEK
- Employee range: 0 to 100,000
- Location string validation (1-100 chars)
- Description validation (10-1000 chars, required)
- Industry description validation (5-500 chars, optional)

### Industry Code Matching ✅ COMPLETE

**Service**: `src/services/industryMatchingService.ts`

Converts user-friendly industry descriptions into Swedish `proffIndustryCode` values using vector embeddings.

- Uses OpenAI text-embedding-3-small model for semantic similarity
- Loads 645 enriched Swedish industry codes from `src/data/enrichedIndustryCodes.json`
- Returns industry codes automatically integrated into Allabolag searches
- Performance: ~1-2 seconds per query

**Example**: "software development" → ["10002115", "10002102", "10002017"]

### Company Search ✅ COMPLETE

**Service**: `src/services/allabolagScraper.ts`

Scrapes Swedish company data from Allabolag.se with advanced filtering.

- Revenue, profit, employee count, location filtering
- Industry code integration (automatic from industry matching)
- Pagination support (configurable page limits)
- Full sorting options support
- CSS selector: `h2 a[href*="/foretag/"]` for reliable company name extraction
- Rate limiting: 1-second delay between requests

### Web Search & Content Extraction ✅ COMPLETE

**Services**:

- `src/services/webSearchService.ts` - Brave Search API integration
- `src/services/aiExtractionService.ts` - Claude-based data extraction

**Search Types**:

- Mission: Company mission/vision/purpose
- Product: Products/services description
- Jobs: Job postings from LinkedIn and Swedish job sites

**Performance**:

- 1-second delay between search types per company
- 2-second delay between companies
- ~15-20 seconds for 5 companies total

### Company Enrichment ✅ COMPLETE

**Service**: `src/services/companyEnrichmentService.ts`

Orchestrates the full enrichment pipeline combining web search and AI extraction.

**Process**:

1. Web search for each company (3 search types: mission, product, jobs)
2. Content extraction and summarization
3. Parallel AI processing with focused extractors
4. Structured data validation via Zod schemas

**Output**: EnrichedCompany objects with mission, product_summary, and job_ads

## Environment Variables

```
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
BRAVE_API_KEY=your_brave_search_key
PORT=4000
```

## File Structure

```
src/
├── services/
│   ├── industryMatchingService.ts    # Industry code matching
│   ├── allabolagScraper.ts          # Company search
│   ├── webSearchService.ts          # Brave Search integration
│   ├── aiExtractionService.ts       # Claude data extraction
│   └── companyEnrichmentService.ts  # Full enrichment pipeline
├── schemas/
│   ├── jobSearch.ts                 # Parameter validation
│   └── companyData.ts              # Response schemas
├── routes/
│   ├── companySearch.ts            # Company search endpoints
│   └── ranking.ts                  # Ranking endpoints (TODO)
├── data/
│   └── enrichedIndustryCodes.json  # Swedish industry codes
└── index.ts                       # Server setup
```

## Dependencies

**Core**: Hono server, TypeScript, Zod validation
**AI**: AI SDK (OpenAI + Anthropic), @anthropic-ai/sdk  
**Web**: Cheerio for HTML parsing, Brave Search API
**Dev**: Vitest testing, Playwright E2E, TSX dev server

## Next Steps

1. ⏳ **Job Ranking Implementation** - Create `POST /api/jobs/rank` endpoint with AI-powered job matching
2. ⏳ **Company Ranking Implementation** - Create `POST /api/companies/rank` endpoint with company fit scoring
3. ⏳ **Frontend Interface** - Simple web UI for testing company search and ranking features
4. ⏳ **Result Optimization** - Caching, deduplication, improved search queries

## Implementation Flow

Based on IMPLEMENTATION_IMAGE.jpeg:

1. **Company Search Flow**: User params → Industry matching → Allabolag scraping → Web enrichment → Enriched companies
2. **Job Ranking Flow**: Job description + Job list → AI ranking → Ranked jobs with scores
3. **Company Ranking Flow**: Company description + Company list → AI ranking → Ranked companies with scores
