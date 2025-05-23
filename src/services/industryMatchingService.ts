import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Schema for industry matching response
const industryMatchSchema = z.object({
  matches: z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        relevance: z.number().min(1).max(10),
      })
    )
    .min(1)
    .max(10),
});

interface EnrichedIndustryCode {
  code: string;
  name: string;
  description: string;
  keywords: string[];
}

interface ScoredIndustry extends EnrichedIndustryCode {
  score: number;
}

export class IndustryMatchingService {
  private client: Anthropic;
  private enrichedCodes: EnrichedIndustryCode[] = [];

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
    this.loadEnrichedCodes();
  }

  /**
   * Load enriched industry codes from JSON file
   */
  private loadEnrichedCodes(): void {
    try {
      // Try to load enriched codes first
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
   * Match industry description to relevant industry codes using fast text similarity
   */
  async matchIndustries(industryDescription: string): Promise<string[]> {
    if (!industryDescription?.trim()) {
      return [];
    }

    console.log(`🔍 Matching industry description: "${industryDescription}"`);

    try {
      // Step 1: Fast text similarity scoring
      const scoredCandidates =
        this.calculateSimilarityScores(industryDescription);

      // Step 2: Filter and sort by score
      const topCandidates = scoredCandidates
        .filter((candidate) => candidate.score > 0.1) // Only keep reasonably similar
        .sort((a, b) => b.score - a.score)
        .slice(0, 15); // Take top 15 for AI refinement

      if (topCandidates.length === 0) {
        console.log("❌ No similar industries found");
        return [];
      }

      console.log(
        `🔍 Found ${topCandidates.length} candidates with similarity > 0.1`
      );
      console.log(
        `🏆 Top 3 by text similarity:`,
        topCandidates
          .slice(0, 3)
          .map((c) => `${c.code} (${c.score.toFixed(3)})`)
      );

      // Step 3: Quick AI refinement of top candidates only
      const finalCodes = await this.refineWithAI(
        industryDescription,
        topCandidates
      );

      console.log(`✅ Found ${finalCodes.length} final matches`);
      return finalCodes;
    } catch (error) {
      console.error("❌ Error matching industries:", error);
      return [];
    }
  }

  /**
   * Calculate text similarity scores using multiple approaches
   */
  private calculateSimilarityScores(query: string): ScoredIndustry[] {
    const normalizedQuery = query.toLowerCase();
    const queryWords = normalizedQuery
      .split(/\s+/)
      .filter((word) => word.length > 2);

    return this.enrichedCodes.map((industry) => {
      let score = 0;

      // Combine all searchable text
      const searchText = [
        industry.name.toLowerCase(),
        industry.description.toLowerCase(),
        ...industry.keywords.map((k) => k.toLowerCase()),
      ].join(" ");

      const searchWords = searchText
        .split(/\s+/)
        .filter((word) => word.length > 2);

      // 1. Exact phrase match (highest score)
      if (searchText.includes(normalizedQuery)) {
        score += 1.0;
      }

      // 2. Word overlap scoring
      const commonWords = queryWords.filter((qWord) =>
        searchWords.some(
          (sWord) =>
            sWord.includes(qWord) ||
            qWord.includes(sWord) ||
            this.areSimilar(qWord, sWord)
        )
      );

      if (commonWords.length > 0) {
        score += (commonWords.length / queryWords.length) * 0.8;
      }

      // 3. Keyword exact matches (bonus)
      const keywordMatches = industry.keywords.filter(
        (keyword) =>
          normalizedQuery.includes(keyword.toLowerCase()) ||
          queryWords.some((qWord) => keyword.toLowerCase().includes(qWord))
      );

      if (keywordMatches.length > 0) {
        score += keywordMatches.length * 0.3;
      }

      // 4. Description relevance
      const descWords = industry.description.toLowerCase().split(/\s+/);
      const descMatches = queryWords.filter((qWord) =>
        descWords.some(
          (dWord) => dWord.includes(qWord) || qWord.includes(dWord)
        )
      );

      if (descMatches.length > 0) {
        score += (descMatches.length / queryWords.length) * 0.5;
      }

      return {
        ...industry,
        score: Math.min(score, 2.0), // Cap at 2.0
      };
    });
  }

  /**
   * Simple string similarity check
   */
  private areSimilar(word1: string, word2: string): boolean {
    if (word1.length < 4 || word2.length < 4) return false;

    // Check if one contains the other (at least 3 chars)
    if (word1.length >= 3 && word2.includes(word1.substring(0, 3))) return true;
    if (word2.length >= 3 && word1.includes(word2.substring(0, 3))) return true;

    return false;
  }

  /**
   * Quick AI refinement of pre-filtered candidates
   */
  private async refineWithAI(
    industryDescription: string,
    candidates: ScoredIndustry[]
  ): Promise<string[]> {
    // If we have very few candidates or very high scores, skip AI
    if (candidates.length <= 3 || candidates[0].score > 1.5) {
      return candidates.slice(0, 8).map((c) => c.code);
    }

    const candidateList = candidates
      .map((c) => `${c.code}: ${c.name} (similarity: ${c.score.toFixed(3)})`)
      .join("\n");

    const prompt = `You are an expert INDUSTRY CLASSIFIER. From these pre-filtered candidates, select the most relevant ones.

Business description: "${industryDescription}"

Pre-filtered candidates (already scored by text similarity):
${candidateList}

Instructions:
- Select the most relevant industry codes (relevance 6+ out of 10)
- ONLY use codes from the list above
- Consider semantic meaning beyond keyword matching
- Return up to 8 most relevant codes

Return JSON:
{
  "matches": [
    {
      "code": "EXACT_CODE_FROM_LIST",
      "name": "EXACT_NAME_FROM_LIST",
      "relevance": 8
    }
  ]
}`;

    try {
      const response = await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from AI");
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Fallback to text similarity results
        return candidates.slice(0, 8).map((c) => c.code);
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      const validatedData = industryMatchSchema.parse(parsedData);

      // Verify codes exist in candidates
      const candidateCodes = new Set(candidates.map((c) => c.code));
      const validMatches = validatedData.matches.filter(
        (match) => candidateCodes.has(match.code) && match.relevance >= 6
      );

      const matchedCodes = validMatches
        .sort((a, b) => b.relevance - a.relevance)
        .map((match) => match.code);

      console.log(
        `🤖 AI refined to ${matchedCodes.length} codes from ${candidates.length} candidates`
      );

      return matchedCodes.length > 0
        ? matchedCodes
        : candidates.slice(0, 5).map((c) => c.code);
    } catch (error) {
      console.error("❌ Error in AI refinement:", error);
      // Fallback to text similarity results
      return candidates.slice(0, 8).map((c) => c.code);
    }
  }

  /**
   * Format industry codes for URL parameter
   */
  formatCodesForUrl(codes: string[]): string {
    if (!codes || codes.length === 0) {
      return "";
    }
    return codes.join("%2C");
  }

  /**
   * Get industry name by code
   */
  getIndustryName(code: string): string {
    const industry = this.enrichedCodes.find((ic) => ic.code === code);
    return industry?.name || "Unknown";
  }
}
