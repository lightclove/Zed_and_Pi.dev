/**
 * DeepSeek cost-tier router.
 *
 * Registers the virtual model `deepseek/auto`, which routes each request to a
 * physical DeepSeek model:
 *
 * - low thinking  -> deepseek-flash (cheap workhorse, multimodal)
 * - high/max      -> deepseek-v4-pro (expensive reasoning)
 *
 * Non-user turns (tool follow-ups, continuations, retries) stay on the model
 * that handled the turn, so DeepSeek's automatic prefix cache stays warm and
 * the session does not pay a cache miss on every tool round-trip.
 *
 * Usage: in pi run `/model deepseek/auto`, then use `/thinking` to escalate.
 */

import type { ExtensionAPI, ExtensionContext, ModelRoute, ModelRouteRequest } from "@earendil-works/pi-coding-agent";

const PROVIDER = "deepseek";
const FLASH = "deepseek-flash";
const PRO = "deepseek-v4-pro";

function routeTo(request: ModelRouteRequest, ctx: ExtensionContext, id: string, level: string): ModelRoute {
  const model = ctx.modelRegistry.find(PROVIDER, id);
  if (!model) throw new Error(`Model ${PROVIDER}/${id} is not in the catalog`);
  return { model, thinkingLevel: level };
}

export default function (pi: ExtensionAPI) {
  pi.registerVirtualModel({
    provider: PROVIDER,
    id: "auto",
    name: "Auto (flash ↔ pro)",
    thinkingLevels: ["low", "high", "max"],
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    route(request, ctx) {
      // Keep continuations, tool follow-ups and retries on the same physical model.
      if (request.reason !== "user") {
        const sticky = request.failed ?? request.previous;
        if (sticky) return { model: sticky.model, thinkingLevel: sticky.thinkingLevel ?? "low" };
      }

      // Escalate only when the user explicitly asks for high/max reasoning.
      if (request.thinkingLevel === "high" || request.thinkingLevel === "max") {
        return routeTo(request, ctx, PRO, request.thinkingLevel);
      }
      return routeTo(request, ctx, FLASH, "low");
    },
  });
}
