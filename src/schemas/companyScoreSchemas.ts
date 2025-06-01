import { z } from "zod";

export const companyScoreRequestQuerySchema = z
  .object({
    userMission: z.string().min(1, "User mission cannot be empty").optional(),
    userProduct: z.string().min(1, "User product cannot be empty").optional(),
    companyMission: z
      .string()
      .min(1, "Company mission cannot be empty")
      .optional(),
    companyProduct: z
      .string()
      .min(1, "Company product cannot be empty")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const { userMission, userProduct, companyMission, companyProduct } = data;

    const hasUserMission = !!userMission;
    const hasCompanyMission = !!companyMission;
    const hasUserProduct = !!userProduct;
    const hasCompanyProduct = !!companyProduct;

    // Check pair consistency
    if (hasUserMission !== hasCompanyMission) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "If userMission is provided, companyMission must also be provided, and vice versa.",
        path: ["missionPair"], // Generic path for the pair
      });
    }
    if (hasUserProduct !== hasCompanyProduct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "If userProduct is provided, companyProduct must also be provided, and vice versa.",
        path: ["productPair"], // Generic path for the pair
      });
    }

    // Check if at least one valid pair is present
    const missionPairValid = hasUserMission && hasCompanyMission;
    const productPairValid = hasUserProduct && hasCompanyProduct;

    if (!missionPairValid && !productPairValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one complete pair (mission or product) must be provided.",
        path: ["base"], // Path indicating a top-level issue
      });
    }
  });

export type CompanyScoreRequestQuery = z.infer<
  typeof companyScoreRequestQuerySchema
>;
