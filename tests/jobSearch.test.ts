import { describe, it, expect } from "vitest";
import { jobSearchParamsSchema } from "../src/schemas/jobSearch.js";

describe("Job Search Parameter Validation", () => {
  describe("Valid parameters", () => {
    it("should accept valid minimal parameters", () => {
      const params = {
        description: "I am looking for a job as a developer",
      };

      const result = jobSearchParamsSchema.parse(params);
      expect(result.description).toBe(params.description);
      expect(result.sort).toBe("profitAsc"); // default value
    });

    it("should accept all valid parameters", () => {
      const params = {
        revenueFrom: 1000000,
        revenueTo: 10000000,
        location: "Stockholm",
        profitFrom: 500000,
        profitTo: 2000000,
        numEmployeesFrom: 10,
        numEmployeesTo: 100,
        sort: "numEmployeesAsc" as const,
        description:
          "I am looking for a job as a developer in a growing tech company",
      };

      const result = jobSearchParamsSchema.parse(params);
      expect(result).toEqual(params);
    });

    it("should accept negative values within range", () => {
      const params = {
        revenueFrom: -1000000,
        revenueTo: 5000000,
        profitFrom: -500000,
        profitTo: 1000000,
        description:
          "Looking for a job in a company that might have had losses",
      };

      const result = jobSearchParamsSchema.parse(params);
      expect(result.revenueFrom).toBe(-1000000);
      expect(result.profitFrom).toBe(-500000);
    });
  });

  describe("Invalid parameters", () => {
    it("should reject missing description", () => {
      const params = {
        location: "Stockholm",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject too short description", () => {
      const params = {
        description: "short",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject too long description", () => {
      const params = {
        description: "x".repeat(1001),
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject revenue values outside range", () => {
      const params = {
        revenueFrom: -3000000, // Below minimum
        description: "Looking for a job",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject profit values outside range", () => {
      const params = {
        profitTo: 200000000, // Above maximum
        description: "Looking for a job",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject negative employee count", () => {
      const params = {
        numEmployeesFrom: -5,
        description: "Looking for a job",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject invalid sort option", () => {
      const params = {
        sort: "invalidSort",
        description: "Looking for a job",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });
  });

  describe("Range validation", () => {
    it("should reject revenue range where from > to", () => {
      const params = {
        revenueFrom: 10000000,
        revenueTo: 5000000,
        description: "Looking for a job",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject profit range where from > to", () => {
      const params = {
        profitFrom: 2000000,
        profitTo: 1000000,
        description: "Looking for a job",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should reject employee count range where from > to", () => {
      const params = {
        numEmployeesFrom: 100,
        numEmployeesTo: 50,
        description: "Looking for a job",
      };

      expect(() => jobSearchParamsSchema.parse(params)).toThrow();
    });

    it("should accept equal from and to values", () => {
      const params = {
        revenueFrom: 5000000,
        revenueTo: 5000000,
        profitFrom: 1000000,
        profitTo: 1000000,
        numEmployeesFrom: 50,
        numEmployeesTo: 50,
        description: "Looking for a job in a specific size company",
      };

      const result = jobSearchParamsSchema.parse(params);
      expect(result).toEqual(expect.objectContaining(params));
    });
  });
});
