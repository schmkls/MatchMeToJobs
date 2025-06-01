import { pipeline, Pipeline } from "@xenova/transformers";
import type {
  CompanyScoreRequestQuery,
  CompanyScoreResponse,
} from "@appTypes/companyScore.types";
import { generateObject } from "ai";
import { z } from "zod";
import { defaultModel } from "@lib/llmModels";

// Define a more specific type for the cross-encoder pipeline
interface CrossEncoderPipeline extends Pipeline {
  (text: string, options: { text_pair: string }): Promise<
    Array<{ score: number }> | { score: number } | number
  >;
}

// Initialize the cross-encoder pipeline
// We use a static variable to ensure the model is loaded only once.
let crossEncoderPipeline: CrossEncoderPipeline | null = null;
async function getCrossEncoder(): Promise<CrossEncoderPipeline> {
  if (!crossEncoderPipeline) {
    try {
      // Using a model known for semantic similarity and compatible with transformers.js
      // The 'text-classification' pipeline with a cross-encoder model can give similarity scores.
      // The model will output a score, often for a "positive" or "related" class if not directly similarity.
      // We might need to adjust based on the specific model's output structure.
      // Xenova/ms-marco-MiniLM-L-6-v2-fused is a good candidate.
      crossEncoderPipeline = (await pipeline(
        "text-classification",
        "Xenova/ms-marco-MiniLM-L-6-v2-fused",
        { quantized: true }
      )) as CrossEncoderPipeline;
    } catch (error) {
      console.error("Failed to load cross-encoder model:", error);
      throw new Error("Failed to load cross-encoder model");
    }
  }
  return crossEncoderPipeline;
}

export class CompanyScorerService {
  public async scoreCompany(
    queryParams: CompanyScoreRequestQuery
  ): Promise<CompanyScoreResponse> {
    const { userMission, userProduct, companyMission, companyProduct } =
      queryParams;

    let llmMissionScore: number | null = null;
    let llmProductScore: number | null = null;
    let ceMissionScore: number | null = null;
    let ceProductScore: number | null = null;

    const scoreSchema = z.object({
      score: z
        .number()
        .min(0)
        .max(1)
        .describe("The similarity score between 0.0 and 1.0."),
    });

    // --- LLM Scoring (Anthropic) ---
    // Only score mission if both userMission and companyMission are provided
    if (userMission && companyMission) {
      try {
        const missionPrompt =
          "CONTEXT: You are an expert in evaluating the semantic similarity between a user's desired company mission and an actual company's mission statement." +
          "\n" +
          `User's desired mission: "${userMission}"` +
          "\n" +
          `Company's actual mission: "${companyMission}"` +
          "\n" +
          "TASK: Score the similarity on a scale from 0.0 to 1.0, where 0.0 means no similarity and 1.0 means perfect semantic match." +
          "\n" +
          'OUTPUT: Respond with a JSON object containing a single key "score" with the numerical score (e.g., {"score": 0.75}).';

        const { object } = await generateObject({
          model: defaultModel,
          schema: scoreSchema,
          prompt: missionPrompt,
        });
        llmMissionScore = object.score;
      } catch (error) {
        console.error("Error during LLM mission scoring:", error);
        console.warn(
          "LLM mission scoring failed or returned an invalid format, resulting in null score."
        );
      }
    }

    // Only score product if both userProduct and companyProduct are provided
    if (userProduct && companyProduct) {
      try {
        const productPrompt =
          "CONTEXT: You are an expert in evaluating the semantic similarity between a user's desired company product/service category and an actual company's product/service description." +
          "\n" +
          `User's desired product/service category: "${userProduct}"` +
          "\n" +
          `Company's actual product/service: "${companyProduct}"` +
          "\n" +
          "TASK: Score the similarity on a scale from 0.0 to 1.0, where 0.0 means no similarity and 1.0 means perfect semantic match." +
          "\n" +
          'OUTPUT: Respond with a JSON object containing a single key "score" with the numerical score (e.g., {"score": 0.8}).';

        const { object } = await generateObject({
          model: defaultModel,
          schema: scoreSchema,
          prompt: productPrompt,
        });
        llmProductScore = object.score;
      } catch (error) {
        console.error("Error during LLM product scoring:", error);
        console.warn(
          "LLM product scoring failed or returned an invalid format, resulting in null score."
        );
      }
    }

    // Define a helper function to extract scores from CE results
    const extractCeScore = (result: any): number | null => {
      if (
        Array.isArray(result) &&
        result.length > 0 &&
        typeof result[0].score === "number"
      ) {
        return result[0].score;
      } else if (typeof result === "number") {
        return result;
      } else if (result && typeof result.score === "number") {
        return result.score;
      }
      console.warn("Unexpected CE result format:", result);
      return null;
    };

    // --- Cross-Encoder Scoring ---
    if (userMission && companyMission) {
      try {
        const ce = await getCrossEncoder();
        const ceMissionResult = await ce(userMission, {
          text_pair: companyMission,
        });

        ceMissionScore = extractCeScore(ceMissionResult);
        if (
          ceMissionScore !== null &&
          (ceMissionScore < 0 || ceMissionScore > 1)
        ) {
          console.error("Invalid CE mission score or format:", ceMissionResult);
          ceMissionScore = null;
          console.warn(
            "CE mission scoring returned an out-of-range score, resulting in null score."
          );
        }
      } catch (error) {
        console.error("Error during Cross-Encoder mission scoring:", error);
        // ceMissionScore remains null
      }
    }

    if (userProduct && companyProduct) {
      try {
        const ce = await getCrossEncoder();
        const ceProductResult = await ce(userProduct, {
          text_pair: companyProduct,
        });

        ceProductScore = extractCeScore(ceProductResult);
        if (
          ceProductScore !== null &&
          (ceProductScore < 0 || ceProductScore > 1)
        ) {
          console.error("Invalid CE product score or format:", ceProductResult);
          ceProductScore = null;
          console.warn(
            "CE product scoring returned an out-of-range score, resulting in null score."
          );
        }
      } catch (error) {
        console.error("Error during Cross-Encoder product scoring:", error);
      }
    }

    return {
      llmMissionScore,
      llmProductScore,
      ceMissionScore,
      ceProductScore,
    };
  }
}
