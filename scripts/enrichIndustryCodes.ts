import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

interface IndustryCode {
  code: string;
  name: string;
}

interface EnrichedIndustryCode {
  code: string;
  name: string;
  description: string;
  keywords: string[];
}

async function enrichIndustryCodes(): Promise<void> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.error("❌ ANTHROPIC_API_KEY not found in environment");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: anthropicApiKey });

  try {
    // Read existing industry codes
    const inputPath = path.join(
      process.cwd(),
      "src",
      "data",
      "industryCodes.json"
    );
    const outputPath = path.join(
      process.cwd(),
      "src",
      "data",
      "enrichedIndustryCodes.json"
    );

    const data = fs.readFileSync(inputPath, "utf-8");
    const industryCodes: IndustryCode[] = JSON.parse(data);

    console.log(`📊 Enriching ${industryCodes.length} industry codes...`);

    const enrichedCodes: EnrichedIndustryCode[] = [];
    const batchSize = 20; // Process in smaller batches

    for (let i = 0; i < industryCodes.length; i += batchSize) {
      const batch = industryCodes.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(industryCodes.length / batchSize);

      console.log(
        `🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} codes)`
      );

      const enrichedBatch = await enrichBatch(client, batch);
      enrichedCodes.push(...enrichedBatch);

      // Save progress periodically
      if (batchNum % 5 === 0) {
        fs.writeFileSync(outputPath, JSON.stringify(enrichedCodes, null, 2));
        console.log(
          `💾 Saved progress: ${enrichedCodes.length} codes processed`
        );
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Final save
    fs.writeFileSync(outputPath, JSON.stringify(enrichedCodes, null, 2));
    console.log(
      `✅ Successfully enriched all ${enrichedCodes.length} industry codes`
    );
    console.log(`📁 Saved to: ${outputPath}`);
  } catch (error) {
    console.error("❌ Error enriching industry codes:", error);
    process.exit(1);
  }
}

async function enrichBatch(
  client: Anthropic,
  batch: IndustryCode[]
): Promise<EnrichedIndustryCode[]> {
  const industryList = batch.map((ic) => `${ic.code}: ${ic.name}`).join("\n");

  const prompt = `You are an expert in Swedish business classifications. For each industry code below, provide:
1. A clear English description of what this industry/business type does
2. 3-5 relevant keywords in English (things someone might search for)

Swedish industry codes:
${industryList}

Return ONLY valid JSON in this exact format:
{
  "enriched": [
    {
      "code": "EXACT_CODE_FROM_ABOVE",
      "name": "EXACT_NAME_FROM_ABOVE",
      "description": "Clear English description of this industry/business type",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}

Focus on:
- What services/products this industry provides
- What type of work/business it represents  
- Common search terms someone might use
- Keep descriptions concise but informative`;

  try {
    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from AI");
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("AI Response:", content.text);
      throw new Error("No JSON found in AI response");
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    // Validate that we got all codes back
    if (!parsedData.enriched || parsedData.enriched.length !== batch.length) {
      console.warn(
        `⚠️ Expected ${batch.length} codes, got ${
          parsedData.enriched?.length || 0
        }`
      );
    }

    return parsedData.enriched as EnrichedIndustryCode[];
  } catch (error) {
    console.error("❌ Error in batch enrichment:", error);

    // Fallback: return original data with basic enrichment
    return batch.map((ic) => ({
      code: ic.code,
      name: ic.name,
      description: ic.name, // Use Swedish name as fallback
      keywords: ic.name
        .toLowerCase()
        .split(/[,\s-]+/)
        .filter((w) => w.length > 2),
    }));
  }
}

enrichIndustryCodes();
