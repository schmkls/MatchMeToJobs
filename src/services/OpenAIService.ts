import OpenAI from "openai";

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required.");
    }
    this.client = new OpenAI({ apiKey });
  }

  async getCompanyInfo(
    companyName: string
  ): Promise<{ mission?: string; product?: string }> {
    if (!companyName || companyName.trim() === "") {
      console.warn("Company name is empty, skipping OpenAI queries.");
      return {};
    }

    let mission: string | undefined = undefined;
    let product: string | undefined = undefined;

    try {
      console.log(`[OpenAIService] Fetching mission for ${companyName}`);
      const missionResponse = await this.client.responses.create({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `What is the mission statement of ${companyName} as stated on their official website?`,
      });

      mission = missionResponse.output_text?.trim() || undefined;
      if (mission) {
        console.log(
          `[OpenAIService] Found mission for ${companyName}: ${mission.substring(
            0,
            100
          )}...`
        );
      }
    } catch (error) {
      console.error(
        `[OpenAIService] Error fetching mission for ${companyName}:`,
        error
      );
      // Fall through, mission will be undefined
    }

    try {
      console.log(
        `[OpenAIService] Fetching product/service info for ${companyName}`
      );
      const productResponse = await this.client.responses.create({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: `What specific service or product does ${companyName} provide as described on their official website?`,
      });

      product = productResponse.output_text?.trim() || undefined;
      if (product) {
        console.log(
          `[OpenAIService] Found product/service for ${companyName}: ${product.substring(
            0,
            100
          )}...`
        );
      }
    } catch (error) {
      console.error(
        `[OpenAIService] Error fetching product/service info for ${companyName}:`,
        error
      );
      // Fall through, product will be undefined
    }

    return { mission, product };
  }
}
