import { IndustryMatchingService } from "../src/services/industryMatchingService.js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function quickTest(): Promise<void> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.error("❌ ANTHROPIC_API_KEY not found in environment");
    process.exit(1);
  }

  try {
    console.log(
      "🧪 Quick Industry Matching Test (Anthropic Semantic Analysis)\n"
    );

    const industryMatcher = new IndustryMatchingService(anthropicApiKey);

    // Test different types of industry descriptions
    const testCases = [
      "software development and programming",
      "web development",
      "artificial intelligence and AI",
      "restaurant and food service",
      "construction and building",
    ];

    for (const testDescription of testCases) {
      console.log(`\n🔍 Testing: "${testDescription}"`);

      const codes = await industryMatcher.matchIndustries(testDescription);

      if (codes.length > 0) {
        console.log(`✅ Found ${codes.length} matches:`);
        codes.forEach((code) => {
          const name = industryMatcher.getIndustryName(code);
          console.log(`   - ${code}: ${name}`);
        });
      } else {
        console.log(`❌ No matches found`);
      }
    }

    console.log("\n🎉 Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

quickTest();
