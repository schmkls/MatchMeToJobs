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
    try {
      const missionPrompt = `CONTEXT: You are an expert in evaluating the semantic similarity between a user\'s desired company mission and an actual company\'s mission statement.
      User\'s desired mission: "${userMission}"
      Company\'s actual mission: "${companyMission}"
      TASK: Score the similarity on a scale from 0.0 to 1.0, where 0.0 means no similarity and 1.0 means perfect semantic match.
      OUTPUT: Respond ONLY with the numerical score (e.g., 0.75).`;

      const productPrompt = `CONTEXT: You are an expert in evaluating the semantic similarity between a user\'s desired company product/service category and an actual company\'s product/service description.
      User\'s desired product/service category: "${userProduct}"
      Company\'s actual product/service: "${companyProduct}"
      TASK: Score the similarity on a scale from 0.0 to 1.0, where 0.0 means no similarity and 1.0 means perfect semantic match.
      OUTPUT: Respond ONLY with the numerical score (e.g., 0.8).`;

      const [missionResult, productResult] = await Promise.all([
        anthropic.generateText({
          modelId: "claude-3-haiku-20240307",
          prompt: missionPrompt,
        }), // Using a cost-effective and fast model
        anthropic.generateText({
          modelId: "claude-3-haiku-20240307",
          prompt: productPrompt,
        }),
      ]);

      llmMissionScore = parseFloat(missionResult.text.trim());
      llmProductScore = parseFloat(productResult.text.trim());

      if (
        isNaN(llmMissionScore) ||
        llmMissionScore < 0 ||
        llmMissionScore > 1
      ) {
        console.error("Invalid LLM mission score:", missionResult.text);
        throw new Error("Failed to get a valid LLM mission score.");
      }
      if (
        isNaN(llmProductScore) ||
        llmProductScore < 0 ||
        llmProductScore > 1
      ) {
        console.error("Invalid LLM product score:", productResult.text);
        throw new Error("Failed to get a valid LLM product score.");
      }
    } catch (error) {
      console.error("Error during LLM scoring:", error);
      throw new Error(
        "LLM scoring failed. " +
          (error instanceof Error ? error.message : String(error))
      );
    }

    // --- Cross-Encoder Scoring ---
    try {
      const ce = await getCrossEncoder();
      const missionPair = [userMission, companyMission] as [string, string];
      const productPair = [userProduct, companyProduct] as [string, string];

      // The output of text-classification with cross-encoders might be an array of classes with scores.
      // e.g., [{ label: 'ENTAILMENT', score: 0.9 }, { label: 'CONTRADICTION', score: 0.1 }]
      // Or for some models trained on similarity, it might be simpler.
      // We expect a score that represents similarity.
      // If the model returns multiple labels, we usually look for the score of the "positive" or "related" label,
      // or a direct similarity score if the model is designed that way.
      // For "Xenova/ms-marco-MiniLM-L-6-v2-fused", it's typically used in reranking,
      // providing a single score indicating relevance.
      const [ceMissionResult, ceProductResult] = await Promise.all([
        ce(missionPair[0], { text_pair: missionPair[1] }), // Some pipelines take (text, { text_pair: text2 })
        ce(productPair[0], { text_pair: productPair[1] }),
      ]);

      // Helper to extract score, assuming the relevant score is the first one or named 'score'
      const extractCeScore = (result: any): number | null => {
        if (
          Array.isArray(result) &&
          result.length > 0 &&
          typeof result[0].score === "number"
        ) {
          return result[0].score; // Common pattern for classification pipelines
        } else if (typeof result === "number") {
          return result; // If the model directly returns a score
        } else if (result && typeof result.score === "number") {
          return result.score; // if it's an object with a score property
        }
        console.warn("Unexpected CE result format:", result);
        return null;
      };

      ceMissionScore = extractCeScore(ceMissionResult);
      ceProductScore = extractCeScore(ceProductResult);

      if (ceMissionScore === null || ceMissionScore < 0 || ceMissionScore > 1) {
        console.error("Invalid CE mission score or format:", ceMissionResult);
        throw new Error("Failed to get a valid CE mission score.");
      }
      if (ceProductScore === null || ceProductScore < 0 || ceProductScore > 1) {
        console.error("Invalid CE product score or format:", ceProductResult);
        throw new Error("Failed to get a valid CE product score.");
      }
    } catch (error) {
      console.error("Error during Cross-Encoder scoring:", error);
      throw new Error(
        "Cross-Encoder scoring failed. " +
          (error instanceof Error ? error.message : String(error))
      );
    }

    // Final check as per user requirement: throw error if any score is still null
    if (
      llmMissionScore === null ||
      llmProductScore === null ||
      ceMissionScore === null ||
      ceProductScore === null
    ) {
      throw new Error("One or more scores could not be determined.");
    }

    return {
      llmMissionScore,
      llmProductScore,
      ceMissionScore,
      ceProductScore,
    };
  }
}
