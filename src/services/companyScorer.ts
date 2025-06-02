import type {
  CompanyScoreRequestQuery,
  CompanyScoreResponse,
} from "@appTypes/companyScore.types";
import { generateObject } from "ai";
import { z } from "zod";
import { defaultModel } from "@lib/llmModels";
import {
  TextSimilarityService,
  TextSimilarityModel,
} from "./textSimilarityService";

export class CompanyScorerService {
  private textSimilarityService: TextSimilarityService;

  constructor() {
    this.textSimilarityService = new TextSimilarityService();
  }

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

    // --- Embedding Model Scoring using TextSimilarityService ---
    if (userMission && companyMission) {
      try {
        // Try with the default MINILM model first
        ceMissionScore = await this.textSimilarityService.getSimilarityScore(
          userMission,
          companyMission,
          TextSimilarityModel.MINILM
        );

        if (ceMissionScore === null) {
          console.warn(
            "Text similarity mission scoring returned null, trying alternative model."
          );

          // Try the paraphrase model as fallback
          ceMissionScore = await this.textSimilarityService.getSimilarityScore(
            userMission,
            companyMission,
            TextSimilarityModel.PARAPHRASE
          );
        }
      } catch (error) {
        console.error("Error during text similarity mission scoring:", error);
        // ceMissionScore remains null
      }
    }

    if (userProduct && companyProduct) {
      try {
        // Try with the default MINILM model first
        ceProductScore = await this.textSimilarityService.getSimilarityScore(
          userProduct,
          companyProduct,
          TextSimilarityModel.MINILM
        );

        if (ceProductScore === null) {
          console.warn(
            "Text similarity product scoring returned null, trying alternative model."
          );

          // Try the paraphrase model as fallback
          ceProductScore = await this.textSimilarityService.getSimilarityScore(
            userProduct,
            companyProduct,
            TextSimilarityModel.PARAPHRASE
          );
        }
      } catch (error) {
        console.error("Error during text similarity product scoring:", error);
        // ceProductScore remains null
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
