import { embed, embedMany, cosineSimilarity } from "ai";
import { openai } from "@ai-sdk/openai";
// import { z } from "zod"; // z is no longer needed if industryMatchSchema is removed
import * as fs from "fs";
import * as path from "path";

// Schema for industry matching response (REMOVED as unused)
// const industryMatchSchema = z.object({
//   matches: z
//     .array(
//       z.object({
//         code: z.string(),
//         name: z.string(),
//         relevance: z.number().min(1).max(10),
//       })
//     )
//     .min(1)
//     .max(10),
// });

interface EnrichedIndustryCode {
  code: string;
  name: string;
  description: string;
  keywords: string[];
}

interface ScoredIndustry extends EnrichedIndustryCode {
  similarity: number;
  embedding?: number[];
}

/**
 * Industry Matching Service
 *
 * Converts user-friendly industry descriptions (e.g., "software development")
 * into Swedish proffIndustryCode values using vector embeddings.
 *
 * Process:
 * 1. Load enriched Swedish industry codes with pre-computed embeddings
 * 2. Generate embedding for user query
 * 3. Calculate cosine similarity with all industry embeddings
 * 4. Return top matches sorted by similarity
 *
 * Performance: ~1-2 seconds per query (embedding generation)
 *
 * Examples:
 * - "software development" → ["10002115", "10002102", "10002017"]
 * - "web development" → ["10004496", "10002115", "10002383"]
 * - "restaurants" → ["10006755", "10241591", "10006767"]
 */
export class IndustryMatchingService {
  private enrichedCodes: EnrichedIndustryCode[] = [];
  private industryEmbeddings: Map<string, number[]> = new Map();
  private embeddingModel = openai.embedding("text-embedding-3-small");

  constructor() {
    this.loadEnrichedCodes();
  }

  /**
   * Load enriched industry codes from JSON file
   * Fallback to basic codes if enriched version not available
   */
  private loadEnrichedCodes(): void {
    try {
      // Try to load enriched codes first (includes English descriptions + keywords)
      const enrichedPath = path.join(
        process.cwd(),
        "src",
        "data",
        "enrichedIndustryCodes.json"
      );

      if (fs.existsSync(enrichedPath)) {
        const data = fs.readFileSync(enrichedPath, "utf-8");
        this.enrichedCodes = JSON.parse(data);
        console.log(
          `📊 Loaded ${this.enrichedCodes.length} enriched industry codes`
        );
        return;
      }

      // Fallback to basic codes if enriched not available
      console.log("⚠️ Enriched codes not found, falling back to basic codes");
      const basicPath = path.join(
        process.cwd(),
        "src",
        "data",
        "industryCodes.json"
      );
      const basicData = fs.readFileSync(basicPath, "utf-8");
      const basicCodes = JSON.parse(basicData);

      // Convert basic codes to enriched format
      this.enrichedCodes = basicCodes.map(
        (ic: { code: string; name: string }) => ({
          code: ic.code,
          name: ic.name,
          description: ic.name,
          keywords: ic.name
            .toLowerCase()
            .split(/[,\s-]+/)
            .filter((w: string) => w.length > 2),
        })
      );

      console.log(
        `📊 Loaded ${this.enrichedCodes.length} basic industry codes (consider running enrichment script)`
      );
    } catch (error) {
      console.error("❌ Error loading industry codes:", error);
      throw new Error("Failed to load industry codes");
    }
  }

  /**
   * Generate and cache embeddings for all industry codes
   * This is called once during initialization or when needed
   */
  private async generateIndustryEmbeddings(): Promise<void> {
    if (this.industryEmbeddings.size > 0) {
      return; // Already generated
    }

    console.log("🔄 Generating embeddings for industry codes...");

    try {
      // Prepare searchable text for each industry
      const industryTexts = this.enrichedCodes.map((industry) => {
        const searchableText = [
          industry.name,
          industry.description,
          ...industry.keywords,
        ].join(" ");
        return searchableText;
      });

      // Generate embeddings in batches
      const { embeddings } = await embedMany({
        model: this.embeddingModel,
        values: industryTexts,
      });

      // Cache embeddings
      this.enrichedCodes.forEach((industry, index) => {
        this.industryEmbeddings.set(industry.code, embeddings[index]);
      });

      console.log(
        `✅ Generated embeddings for ${embeddings.length} industries`
      );
    } catch (error) {
      console.error("❌ Error generating industry embeddings:", error);
      throw new Error("Failed to generate industry embeddings");
    }
  }

  /**
   * Main matching method: converts industry description to Swedish industry codes
   *
   * @param industryDescription - User description like "software development"
   * @returns Array of Swedish industry codes like ["10002115", "10002102"]
   */
  async matchIndustries(industryDescription: string): Promise<string[]> {
    if (!industryDescription?.trim()) {
      return [];
    }

    console.log(`🔍 Matching industry description: "${industryDescription}"`);

    try {
      // Ensure industry embeddings are generated
      await this.generateIndustryEmbeddings();

      // Generate embedding for the query
      const { embedding: queryEmbedding } = await embed({
        model: this.embeddingModel,
        value: industryDescription,
      });

      // Calculate similarities with all industries
      const scoredIndustries: ScoredIndustry[] = this.enrichedCodes.map(
        (industry) => {
          const industryEmbedding = this.industryEmbeddings.get(industry.code);
          if (!industryEmbedding) {
            throw new Error(`Missing embedding for industry: ${industry.code}`);
          }

          const similarity = cosineSimilarity(
            queryEmbedding,
            industryEmbedding
          );

          return {
            ...industry,
            similarity,
          };
        }
      );

      // Sort by similarity and filter top results
      const topMatches = scoredIndustries
        .filter((industry) => industry.similarity > 0.3) // Only keep reasonably similar
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8); // Take top 8 matches

      if (topMatches.length === 0) {
        console.log("❌ No similar industries found");
        return [];
      }

      console.log(
        `🔍 Found ${topMatches.length} matches with similarity > 0.3`
      );
      console.log(
        `🏆 Top 3 by similarity:`,
        topMatches
          .slice(0, 3)
          .map((c) => `${c.code} (${c.similarity.toFixed(3)})`)
      );

      const matchedCodes = topMatches.map((match) => match.code);
      console.log(`✅ Found ${matchedCodes.length} final matches`);
      return matchedCodes;
    } catch (error) {
      console.error("❌ Error matching industries:", error);
      return [];
    }
  }

  /**
   * Get industry name by code (for debugging/logging)
   */
  getIndustryName(code: string): string {
    const industry = this.enrichedCodes.find((ic) => ic.code === code);
    return industry?.name || "Unknown";
  }
}
