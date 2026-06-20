import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicKey } from "@/lib/env";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({ apiKey: getAnthropicKey() });
  return _client;
}
