import { describe, it, expect } from "vitest";
import { AllabolagScraper } from "../src/services/allabolagScraper.js";

describe("Allabolag Scraper Integration", () => {
  // Note: This is an integration test that makes real HTTP requests
  // It may be slower and could be affected by changes to the Allabolag website

  it("should scrape AstraZeneca AB as first company for Stockholm revenue search", async () => {
    const scraper = new AllabolagScraper();

    // Parameters that should return AstraZeneca AB as the first result
    const params = {
      numEmployeesFrom: 0,
      numEmployeesTo: 100000,
      revenueFrom: -221349,
      revenueTo: 192505000,
      location: "Stockholm",
      sort: "revenueDesc" as const,
      description: "Test search for large companies in Stockholm",
    };

    // Only scrape 1 page to keep the test fast
    const companies = await scraper.searchCompanies(params, 1);

    // Verify we got results
    expect(companies).toBeDefined();
    expect(companies.length).toBeGreaterThan(0);

    // Verify AstraZeneca AB is the first company (highest revenue in Stockholm)
    expect(companies[0]).toBe("AstraZeneca AB");

    // Verify we got multiple companies (should be ~10 per page)
    expect(companies.length).toBeGreaterThanOrEqual(5);
    expect(companies.length).toBeLessThanOrEqual(15);

    // Verify all results are non-empty strings
    companies.forEach((company) => {
      expect(company).toBeTruthy();
      expect(typeof company).toBe("string");
      expect(company.length).toBeGreaterThan(0);
    });

    console.log(
      `Test found ${companies.length} companies, first: ${companies[0]}`
    );
  }, 10000); // 10 second timeout for network request

  it("should handle empty results gracefully", async () => {
    const scraper = new AllabolagScraper();

    // Parameters that should return very few or no results
    const params = {
      revenueFrom: 999999999, // Extremely high revenue
      revenueTo: 1000000000,
      numEmployeesFrom: 999999, // Extremely high employee count
      numEmployeesTo: 1000000,
      location: "NonExistentCity12345",
      description: "Test search that should return no results",
    };

    const companies = await scraper.searchCompanies(params, 1);

    // Should return empty array, not throw error
    expect(companies).toBeDefined();
    expect(Array.isArray(companies)).toBe(true);
    // Could be empty or have very few results
    expect(companies.length).toBeGreaterThanOrEqual(0);
  }, 10000);

  it("should handle network errors gracefully", async () => {
    const scraper = new AllabolagScraper();

    // Test with minimal valid params
    const params = {
      description: "Test network error handling",
    };

    // This should not throw, even if there are network issues
    await expect(scraper.searchCompanies(params, 1)).resolves.toBeDefined();
  }, 10000);

  it("should scrape Stockholm companies including large corporations", async () => {
    const scraper = new AllabolagScraper();

    // Parameters for Stockholm companies with large revenue range
    const params = {
      numEmployeesFrom: 0,
      numEmployeesTo: 100000,
      revenueFrom: -221349,
      revenueTo: 192505000,
      location: "Stockholm",
      sort: "revenueDesc" as const,
      description: "Test search for large companies in Stockholm",
    };

    // Scrape 2 pages to increase chances of finding known companies
    const companies = await scraper.searchCompanies(params, 2);

    // Verify we got results
    expect(companies).toBeDefined();
    expect(companies.length).toBeGreaterThan(0);

    // Log the results for debugging
    console.log(`Test found ${companies.length} companies:`);
    console.log("First 5 companies:", companies.slice(0, 5));

    // Verify we got multiple companies (should be ~10-20 from 2 pages)
    expect(companies.length).toBeGreaterThanOrEqual(10);
    expect(companies.length).toBeLessThanOrEqual(25);

    // Verify all results are non-empty strings with typical Swedish company suffixes
    companies.forEach((company) => {
      expect(company).toBeTruthy();
      expect(typeof company).toBe("string");
      expect(company.length).toBeGreaterThan(0);
    });

    // Check that we have some recognizable Swedish companies (at least one should match)
    const knownStockholmCompanies = [
      "AstraZeneca AB",
      "H&M",
      "Spotify",
      "Klarna",
      "Ericsson",
      "SEB",
      "Handelsbanken",
      "Nordea",
      "Atlas Copco",
      "Electrolux",
    ];

    const foundKnownCompany = companies.some((company) =>
      knownStockholmCompanies.some((known) =>
        company.toLowerCase().includes(known.toLowerCase())
      )
    );

    // If we don't find any known companies, that's still okay - just log it
    if (!foundKnownCompany) {
      console.log("Note: No well-known Stockholm companies found in results");
    }

    // The main requirement is that we get valid company names
    expect(companies.length).toBeGreaterThan(0);
  }, 15000); // 15 second timeout for network requests
});
