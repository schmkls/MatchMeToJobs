import { z } from "zod";

export const jobSearchParamsSchema = z
  .object({
    revenueFrom: z
      .number()
      .min(-2213349, "Revenue from must be at least -2,213,349")
      .max(192505000, "Revenue from must be at most 192,505,000")
      .optional(),

    revenueTo: z
      .number()
      .min(-2213349, "Revenue to must be at least -2,213,349")
      .max(192505000, "Revenue to must be at most 192,505,000")
      .optional(),

    location: z
      .string()
      .min(1, "Location cannot be empty")
      .max(100, "Location must be less than 100 characters")
      .optional(),

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
        "registrationDateDesc",
        "numEmployeesAsc",
        "revenueAsc",
        "revenueDesc",
      ])
      .optional()
      .default("profitAsc"),

    description: z
      .string()
      .min(10, "Description must be at least 10 characters long")
      .max(1000, "Description must be less than 1000 characters"),
  })
  .refine(
    (data) => {
      // Validate revenue range
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
      // Validate profit range
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
      // Validate employee count range
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

export type JobSearchParams = z.infer<typeof jobSearchParamsSchema>;
