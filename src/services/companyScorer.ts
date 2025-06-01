import { Anthropic } from "@ai-sdk/anthropic";
import { pipeline, Pipeline } from "@xenova/transformers";
import {
  CompanyScoreRequestQuery,
  CompanyScoreResponse,
} from "types/companyScore.types";

// Initialize Anthropic. ANTHROPIC_API_KEY should be in .env
const anthropic = new Anthropic();

// Initialize the cross-encoder pipeline
// We use a static variable to ensure the model is loaded only once.
let crossEncoderPipeline: Pipeline | null = null;
async function getCrossEncoder() {
  if (!crossEncoderPipeline) {
    try {
      // Using a model known for semantic similarity and compatible with transformers.js
      // The 'text-classification' pipeline with a cross-encoder model can give similarity scores.
      // The model will output a score, often for a "positive" or "related" class if not directly similarity.
      // We might need to adjust based on the specific model's output structure.
      // Xenova/ms-marco-MiniLM-L-6-v2-fused is a good candidate.
      crossEncoderPipeline = await pipeline(
        "text-classification",
        "Xenova/ms-marco-MiniLM-L-6-v2-fused",
        { quantized: true }
      );
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

    // --- LLM Scoring (Anthropic) ---
    // Only score mission if both userMission and companyMission are provided
    if (userMission && companyMission) {
      try {
        const missionPrompt = `CONTEXT: You are an expert in evaluating the semantic similarity between a user\'s desired company mission and an actual company\'s mission statement.
        User\'s desired mission: "${userMission}"
        Company\'s actual mission: "${companyMission}"
        TASK: Score the similarity on a scale from 0.0 to 1.0, where 0.0 means no similarity and 1.0 means perfect semantic match.
        OUTPUT: Respond ONLY with the numerical score (e.g., 0.75).`;

        const missionResult = await anthropic.generateText({
          modelId: "claude-3-haiku-20240307",
          prompt: missionPrompt,
        });
        llmMissionScore = parseFloat(missionResult.text.trim());
        if (
          isNaN(llmMissionScore) ||
          llmMissionScore < 0 ||
          llmMissionScore > 1
        ) {
          console.error("Invalid LLM mission score:", missionResult.text);
          // Set to null instead of throwing, or re-throw if it should be a hard error for malformed LLM output
          llmMissionScore = null;
          // Consider if a malformed LLM response for an *attempted* score should be a partial error or just result in null.
          // For now, setting to null to allow other scores to proceed.
          console.warn(
            "LLM mission scoring returned an invalid format, resulting in null score."
          );
        }
      } catch (error) {
        console.error("Error during LLM mission scoring:", error);
        // llmMissionScore remains null
      }
    }

    // Only score product if both userProduct and companyProduct are provided
    if (userProduct && companyProduct) {
      try {
        const productPrompt = `CONTEXT: You are an expert in evaluating the semantic similarity between a user\'s desired company product/service category and an actual company\'s product/service description.
        User\'s desired product/service category: "${userProduct}"
        Company\'s actual product/service: "${companyProduct}"
        TASK: Score the similarity on a scale from 0.0 to 1.0, where 0.0 means no similarity and 1.0 means perfect semantic match.
        OUTPUT: Respond ONLY with the numerical score (e.g., 0.8).`;

        const productResult = await anthropic.generateText({
          modelId: "claude-3-haiku-20240307",
          prompt: productPrompt,
        });
        llmProductScore = parseFloat(productResult.text.trim());
        if (
          isNaN(llmProductScore) ||
          llmProductScore < 0 ||
          llmProductScore > 1
        ) {
          console.error("Invalid LLM product score:", productResult.text);
          llmProductScore = null;
          console.warn(
            "LLM product scoring returned an invalid format, resulting in null score."
          );
        }
      } catch (error) {
        console.error("Error during LLM product scoring:", error);
        // llmProductScore remains null
      }
    }

    // --- Cross-Encoder Scoring ---
    if (userMission && companyMission) {
      try {
        const ce = await getCrossEncoder();
        const missionPair = [userMission, companyMission] as [string, string];
        const ceMissionResult = await ce(missionPair[0], {
          text_pair: missionPair[1],
        });

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
        const productPair = [userProduct, companyProduct] as [string, string];
        const ceProductResult = await ce(productPair[0], {
          text_pair: productPair[1],
        });

        // Re-using extractCeScore defined above. Ensure it is accessible or redefine if needed.
        const extractCeScore = (result: any): number | null => {
          // Definition duplicated for clarity if blocks are moved
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
        // ceProductScore remains null
      }
    }

    // Removed the final check that throws an error if any score is null,
    // as null scores are now acceptable if inputs are missing.

    return {
      llmMissionScore,
      llmProductScore,
      ceMissionScore,
      ceProductScore,
    };
  }
}
