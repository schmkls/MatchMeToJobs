import { z } from "zod";

// Combined schema for all company data
export const enrichedCompanySchema = z.object({
  company_name: z.string().min(2).max(200),
  mission: z.string().optional(),
  product_summary: z.string().optional(),
});

export type EnrichedCompany = z.infer<typeof enrichedCompanySchema>;
