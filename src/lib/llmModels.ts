import { createAnthropic, AnthropicProvider } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
}) as AnthropicProvider;

const claudeHaiku = anthropic("claude-3-haiku-20240307");
export const defaultModel = claudeHaiku as any;
