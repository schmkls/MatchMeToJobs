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

## Next Steps

1. ⏳ **Web Search for Company Information** - Gather additional data about each company
2. ⏳ **AI-Powered Job Matching** - Use Claude/Anthropic API to rank companies
3. ⏳ **Result Optimization** - Cache and filter results
