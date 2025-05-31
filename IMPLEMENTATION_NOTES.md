# Implementation Notes

This document outlines the implementation details and plan for the MatchMeToJobs backend. The project aims to provide a service for searching companies and, in the future, job listings, and then enriching this data.

In this project we use simple, minimal code and dependencies, and priotize researching for pre-existing libraries rather than implementing logic ourselves.

We dont use fallback methods.

## API Overview

The API enables users to first search for companies using various criteria and then enrich selected companies with detailed information. Future developments will introduce job-related search and scoring functionalities.

### User Flow:

1. User searches for companies via `api/companies/search`.
2. User selects a company from the results.
3. User requests enrichment for the selected company via `api/companies/enrich`.

## Current Endpoints & Services

### Endpoint: `api/companies/search`

- **Description:** Finds companies using Allabolag.se segmentation scraping. Uses industryDescription and vector matching to get proffIndustryCode param.
- **Params:**
  - `revenueFrom`, `revenueTo` (Range: -221349 to 192505000)
  - `location` (string)
  - `profitFrom`, `profitTo` (Range: -12153147 to 109441000)
  - `numEmployeesFrom`, `numEmployeesTo` (Range: 0 to 100000)
  - `sort` (Enum: `profitAsc`, `profitDesc`, `revenueAsc`, `revenueDesc`, `registrationDateDesc`, `numEmployeesAsc`, `numEmployeesDesc`)
  - `industryDescription` (string)
- **Example Response:** `["Spotify AB", "GeoGuessr AB", "Anyfin AB"]`
- **Underlying Service:** `Allabolag.se Segmentation Scraping`
  - Scrapes `https://www.allabolag.se/segmentering` using the provided parameters (including matched `proffIndustryCode` from `industryDescription`) to retrieve a list of company names.

### Endpoint: `api/companies/enrich`

- **Description:** Enriches a specified company by searching the web to extract its mission and product summary.
- **Params:**
  - `companyName` (string)
- **Example Response:** `{"product": "One of the world's largest music, podcast and audio streaming services", "mission": "Our mission is to unlock the potential of human creativity—by giving a million creative artists the opportunity to live off their art and billions of fans the opportunity to enjoy and be inspired by it."}`
- **Underlying Service:** `Company Enrichment (Web Search)`
  - Searches the web for the given company to find and extract its product description and mission statement.

## Future implementation

### Endpoint: `api/companies/score`

- **Description:** Scores a company by comparing description and missing to user description and mission.
- **Params:**
  - `userMission` (string)
  - `userProduct` (string)
  - `companyMission` (string)
  - `companyProduct` (string)
- **Example Response:** `{"llmMissionScore": 0.85, "llmProductScore": 0.9, "ceMissionScore": 0.78, "ceProductScore": 0.82}`
- **Underlying Service:** `CompanyScorerService`
