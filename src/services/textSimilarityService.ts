/*
TODO:

The text similarity service should be able to compare the similarity in meaning between two texts.
The length of the texts / number of sentences / number of words should not matter.

 */

import OpenAI from "openai";

/**
 * TextSimilarityService: Compares the similarity in meaning between two texts.
 * Uses OpenAI's embedding model to generate vector representations of text
 * and calculates cosine similarity between them.
 */
export class TextSimilarityService {
  private client: OpenAI;
  private model: string;

  /**
   * Creates a new TextSimilarityService instance.
   * @param apiKey - OpenAI API key
   * @param model - The embedding model to use (default: "text-embedding-3-small")
   */
  constructor(apiKey: string, model: string = "text-embedding-3-small") {
    if (!apiKey) {
      throw new Error("OpenAI API key is required.");
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Gets the embedding vector for a given text.
   * @param text - The text to embed
   * @returns A vector representation of the text
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text.trim(),
    });
    return response.data[0].embedding;
  }

  /**
   * Calculates the cosine similarity between two vectors.
   * @param vec1 - First vector
   * @param vec2 - Second vector
   * @returns A similarity score between 0 and 1
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have the same dimensions");
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }

  /**
   * Gets a similarity score between two texts based on their semantic meaning.
   * @param text1 - First text
   * @param text2 - Second text
   * @returns A similarity score between 0 and 1
   */
  async getSimilarityScore(text1: string, text2: string): Promise<number> {
    if (!text1 || !text2) {
      throw new Error("Both texts are required for comparison");
    }

    try {
      const [embedding1, embedding2] = await Promise.all([
        this.getEmbedding(text1),
        this.getEmbedding(text2),
      ]);

      return this.calculateCosineSimilarity(embedding1, embedding2);
    } catch (error) {
      console.error(
        "[TextSimilarityService] Error calculating similarity:",
        error
      );
      throw new Error("Failed to calculate text similarity");
    }
  }
}
