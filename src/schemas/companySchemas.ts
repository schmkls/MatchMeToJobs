import { z } from "zod";

export const companySearchQuerySchema = z
  .object({
    revenueFrom: z
      .number()
      .min(-221349, "Revenue from must be at least -221,349")
      .max(192505000, "Revenue from must be at most 192,505,000")
      .optional(),
    revenueTo: z
      .number()
      .min(-221349, "Revenue to must be at least -221,349")
      .max(192505000, "Revenue to must be at most 192,505,000")
      .optional(),
    location: z
      .string()
      .min(1, "Location cannot be empty")
      .max(100, "Location must be less than 100 characters")
      .optional(), // Specification says "location (string)", implies optional if not always needed for a general search
    profitFrom: z
      .number()
      .min(-12153147, "Profit from must be at least -12,153,147")
      .max(109441000, "Profit from must be at most 109,441,000")
      .optional(),
    profitTo: z
      .number()
      .min(-12153147, "Profit to must be at least -12,153,147")
      .max(109441000, "Profit to must be at most 109,441,000")
      .optional(),
    numEmployeesFrom: z
      .number()
      .min(0, "Number of employees from must be at least 0")
      .max(100000, "Number of employees from must be at most 100,000")
      .optional(),
    numEmployeesTo: z
      .number()
      .min(0, "Number of employees to must be at least 0")
      .max(100000, "Number of employees to must be at most 100,000")
      .optional(),
    sort: z
      .enum([
        "profitAsc",
        "profitDesc",
        "registrationDateDesc",
        "numEmployeesAsc",
        "numEmployeesDesc",
        "revenueAsc",
        "revenueDesc",
      ])
      .optional(),
    industryDescription: z
      .string()
      .min(3, "Industry description must be at least 3 characters long")
      .max(500, "Industry description must be less than 500 characters")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.revenueFrom !== undefined && data.revenueTo !== undefined) {
        return data.revenueFrom <= data.revenueTo;
      }
      return true;
    },
    {
      message: "Revenue from must be less than or equal to revenue to",
      path: ["revenueFrom"],
    }
  )
  .refine(
    (data) => {
      if (data.profitFrom !== undefined && data.profitTo !== undefined) {
        return data.profitFrom <= data.profitTo;
      }
      return true;
    },
    {
      message: "Profit from must be less than or equal to profit to",
      path: ["profitFrom"],
    }
  )
  .refine(
    (data) => {
      if (
        data.numEmployeesFrom !== undefined &&
        data.numEmployeesTo !== undefined
      ) {
        return data.numEmployeesFrom <= data.numEmployeesTo;
      }
      return true;
    },
    {
      message:
        "Number of employees from must be less than or equal to number of employees to",
      path: ["numEmployeesFrom"],
    }
  );

export type CompanySearchQuery = z.infer<typeof companySearchQuerySchema>;

export const companyEnrichRequestSchema = z.object({
  companyName: z
    .string()
    .min(1, "Company name cannot be empty")
    .max(200, "Company name must be less than 200 characters"),
});

export type CompanyEnrichRequest = z.infer<typeof companyEnrichRequestSchema>;

export const companyEnrichResponseSchema = z.object({
  product: z.string().optional(),
  mission: z.string().optional(),
});

export type CompanyEnrichResponse = z.infer<typeof companyEnrichResponseSchema>;
