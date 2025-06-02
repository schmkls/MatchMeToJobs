import { describe, expect, test, beforeEach } from "vitest";
import { TextSimilarityService } from "../src/services/textSimilarityService";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Skip tests if API key is not available
const maybeDescribe = OPENAI_API_KEY ? describe : describe.skip;

maybeDescribe("TextSimilarityService", () => {
  let service: TextSimilarityService;

  beforeEach(() => {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for these tests");
    }
    service = new TextSimilarityService(OPENAI_API_KEY);
  });

  test("should throw error when API key is not provided", () => {
    expect(() => new TextSimilarityService("")).toThrow(
      "OpenAI API key is required"
    );
  });

  test("should throw error when texts are empty", async () => {
    await expect(service.getSimilarityScore("", "test")).rejects.toThrow();
    await expect(service.getSimilarityScore("test", "")).rejects.toThrow();
  });

  test("identical texts should have high similarity", async () => {
    const text = "This is a test sentence for similarity.";
    const score = await service.getSimilarityScore(text, text);
    expect(score).toBeGreaterThanOrEqual(0.99);
  });

  test("semantically similar texts should have higher scores than dissimilar ones", async () => {
    const text =
      "Tech/dev focused on sustainability or positive societal impact";
    const similarText1 = "We build software to help track food waste";
    const similarText2 =
      "Aurioia is our product that helps track food waste. We enable restaurants to gain insight into how much food they waste and co2 caused by producing the food.";
    const nonSimilarText = "We build software that helps sell private jets";

    const similarText1Score = await service.getSimilarityScore(
      text,
      similarText1
    );
    const similarText2Score = await service.getSimilarityScore(
      text,
      similarText2
    );
    const nonSimilarTextScore = await service.getSimilarityScore(
      text,
      nonSimilarText
    );

    expect(similarText1Score).toBeGreaterThan(nonSimilarTextScore);
    expect(similarText2Score).toBeGreaterThan(nonSimilarTextScore);

    // Log scores for informational purposes
    console.log({
      similarText1Score,
      similarText2Score,
      nonSimilarTextScore,
    });
  });
});
