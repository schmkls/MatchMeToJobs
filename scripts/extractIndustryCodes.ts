import * as fs from "fs";
import * as cheerio from "cheerio";
import * as path from "path";

interface IndustryCode {
  code: string;
  name: string;
}

async function extractIndustryCodes(): Promise<void> {
  try {
    // Read the HTML file
    const htmlPath = path.join(
      process.cwd(),
      "tmp_proffIndustryCodeSelector.html"
    );
    const htmlContent = fs.readFileSync(htmlPath, "utf-8");

    // Parse with Cheerio
    const $ = cheerio.load(htmlContent);

    const industryCodes: IndustryCode[] = [];

    // Extract industry codes and names
    $('li[id*=":rd:-"]').each((index, element) => {
      const id = $(element).attr("id");
      const name = $(element).find(".MuiTreeItem-label").text().trim();

      if (id && name) {
        // Extract the code after ":rd:-"
        const code = id.replace(":rd:-", "");
        industryCodes.push({
          code,
          name,
        });
      }
    });

    // Sort by name for easier browsing
    industryCodes.sort((a, b) => a.name.localeCompare(b.name));

    // Save to JSON file
    const outputPath = path.join(
      process.cwd(),
      "src",
      "data",
      "industryCodes.json"
    );

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(industryCodes, null, 2));

    console.log(
      `✅ Extracted ${industryCodes.length} industry codes to ${outputPath}`
    );
    console.log("Sample entries:");
    console.log(
      industryCodes
        .slice(0, 5)
        .map((ic) => `${ic.code}: ${ic.name}`)
        .join("\n")
    );
  } catch (error) {
    console.error("❌ Error extracting industry codes:", error);
    process.exit(1);
  }
}

extractIndustryCodes();
