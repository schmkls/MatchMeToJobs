import { z } from "zod";

// Simplified schema for company mission extraction
export const companyMissionSchema = z.object({
  mission: z
    .string()
    .describe(
      "Company mission statement or 'not found' if no mission is available"
    ),
});

// Simplified schema for company product/service extraction
export const companyProductSchema = z.object({
  product_summary: z.string().describe("Summary of main products or services"),
});

// Combined schema for all company data
export const enrichedCompanySchema = z.object({
  company_name: z.string().min(2).max(200),
  mission: z.string().optional(),
  product_summary: z.string().optional(),
});

export type CompanyMission = z.infer<typeof companyMissionSchema>;
export type CompanyProduct = z.infer<typeof companyProductSchema>;
export type EnrichedCompany = z.infer<typeof enrichedCompanySchema>;
