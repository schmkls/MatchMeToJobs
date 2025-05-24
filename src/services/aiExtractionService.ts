import { Anthropic } from "@anthropic-ai/sdk";
import {
  companyMissionSchema,
  companyProductSchema,
  jobListingsSchema,
} from "../schemas/companyData.js";
import type {
  CompanyMission,
  CompanyProduct,
  JobListings,
} from "../schemas/companyData.js";

interface ExtractionTask {
  type: "mission" | "product" | "jobs";
  content: string;
  companyName: string;
}

export class AIExtractionService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Extract structured company data from web search content using focused extractors
   */
  async extractCompanyData(
    companyName: string,
    searchContent: {
      mission: string;
      product: string;
      jobs: string;
    }
  ): Promise<{
    mission?: CompanyMission;
    product?: CompanyProduct;
    jobs?: JobListings;
  }> {
    console.log(`🤖 Starting focused AI extraction for: ${companyName}`);

    // Create extraction tasks
    const tasks: ExtractionTask[] = [
      { type: "mission", content: searchContent.mission, companyName },
      { type: "product", content: searchContent.product, companyName },
      { type: "jobs", content: searchContent.jobs, companyName },
    ];

    // Execute extractions in parallel
    const results = await Promise.allSettled(
      tasks.map((task) => this.extractSingleType(task))
    );

    // Combine results
    const extractedData: {
      mission?: CompanyMission;
      product?: CompanyProduct;
      jobs?: JobListings;
    } = {};

    results.forEach((result, index) => {
      const taskType = tasks[index].type;
      if (result.status === "fulfilled" && result.value) {
        switch (taskType) {
          case "mission":
            extractedData.mission = result.value as CompanyMission;
            break;
          case "product":
            extractedData.product = result.value as CompanyProduct;
            break;
          case "jobs":
            extractedData.jobs = result.value as JobListings;
            break;
        }
      } else {
        console.warn(`❌ Failed to extract ${taskType} for ${companyName}`);
      }
    });

    console.log(`✅ Completed extraction for: ${companyName}`);
    return extractedData;
  }

  /**
   * Extract a single type of company information using focused prompts
   */
  private async extractSingleType(
    task: ExtractionTask
  ): Promise<CompanyMission | CompanyProduct | JobListings | null> {
    if (!task.content || task.content.trim().length < 10) {
      console.log(
        `⏭️  Skipping ${task.type} extraction - insufficient content`
      );
      return null;
    }

    try {
      switch (task.type) {
        case "mission":
          return await this.extractMission(task);
        case "product":
          return await this.extractProduct(task);
        case "jobs":
          return await this.extractJobs(task);
        default:
          throw new Error(`Unknown extraction type: ${task.type}`);
      }
    } catch (error) {
      console.error(`❌ Error extracting ${task.type}:`, error);
      return null;
    }
  }

  /**
   * Mission Extractor - Find company mission or return "not found"
   */
  private async extractMission(
    task: ExtractionTask
  ): Promise<CompanyMission | null> {
    console.log("extracting mission for", task.companyName);
    console.log("content", task.content);
    const prompt = `You are a MISSION EXTRACTOR for ${task.companyName}.

Your task: Find the company's mission statement, vision, or core purpose.

Search Results:
${task.content}

Instructions:
- Look for mission statements, company purpose, vision, or "about us" information
- Extract the FULL mission statement (not a summary)
- If no clear mission is found, return exactly "not found"
- Return only JSON format

Expected JSON format:
{
  "mission": "full mission statement or 'not found'"
}`;

    return await this.callAIExtractor(prompt, companyMissionSchema);
  }

  /**
   * Product Extractor - Summarize what the company does/sells
   */
  private async extractProduct(
    task: ExtractionTask
  ): Promise<CompanyProduct | null> {
    const prompt = `You are a PRODUCT EXTRACTOR for ${task.companyName}.

Your task: Create a concise summary of what the company does or sells.

Search Results:
${task.content}

Instructions:
- Summarize the main products or services in 1-2 sentences
- Focus on what the company actually does or sells
- Be specific and clear
- Return only JSON format

Expected JSON format:
{
  "product_summary": "concise summary of products/services"
}`;

    return await this.callAIExtractor(prompt, companyProductSchema);
  }

  /**
   * Jobs Extractor - Find job postings with links
   */
  private async extractJobs(task: ExtractionTask): Promise<JobListings | null> {
    const prompt = `You are a JOBS EXTRACTOR for ${task.companyName}.

Your task: Find job postings and their direct links.

Search Results:
${task.content}

Instructions:
- Find job postings with working URLs
- Extract job title, URL, and platform (LinkedIn, company website, etc.)
- Include only jobs with valid URLs
- Return only JSON format

Expected JSON format:
{
  "job_ads": [
    {
      "title": "job title",
      "url": "direct link to job posting",
      "platform": "LinkedIn/company website/etc"
    }
  ]
}`;

    return await this.callAIExtractor(prompt, jobListingsSchema);
  }

  /**
   * Helper method to call AI and parse response
   */
  private async callAIExtractor(
    prompt: string,
    schema: any
  ): Promise<any | null> {
    const response = await this.client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    try {
      const content = response.content[0];
      if (content.type === "text") {
        // Extract JSON from response
        const jsonMatch = content.text.match(/\{.*\}/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return schema.parse(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to parse AI response:", error);
    }

    return null;
  }
}
