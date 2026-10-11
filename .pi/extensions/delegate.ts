/**
 * `delegate` tool - isolated DeepSeek sub-agents.
 *
 * Runs a nested DeepSeek call with its own system prompt and a focused task.
 * The sub-agent sees only what the caller passes, so parallel, independent
 * work (research, review, planning) does not pollute the main context.
 * Only the final text answer returns to the model.
 *
 * Usage examples (the model calls this tool itself):
 *   delegate({ role: "You are a security reviewer.", task: "Audit this diff: ..." })
 *   delegate({ role: "You are a DB expert.", task: "...", model: "deepseek-v4-pro" })
 */

import { Type, type TextContent } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const delegateTool = defineTool({
  name: "delegate",
  label: "Delegate",
  description:
    "Run an isolated DeepSeek sub-agent with its own system prompt and a focused task. " +
    "Use for independent work (planning, reviewing, researching) without polluting the main context. " +
    "Returns only the final answer.",
  parameters: Type.Object({
    role: Type.String({ description: "System prompt / persona for the sub-agent." }),
    task: Type.String({ description: "The focused task or question for the sub-agent." }),
    model: Type.Optional(
      Type.String({ description: "deepseek-flash (default, cheap) or deepseek-v4-pro (hard reasoning)." }),
    ),
  }),

  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    // Hamilton: detect errors at the boundary — never silently coerce invalid input.
    const task = params.task.trim();
    if (!task) {
      return {
        content: [{ type: "text", text: "delegate: task must not be empty" }],
        details: { error: "empty-task" },
        isError: true,
      };
    }
    if (!params.role.trim()) {
      return {
        content: [{ type: "text", text: "delegate: role must not be empty" }],
        details: { error: "empty-role" },
        isError: true,
      };
    }
    const modelId = params.model ?? "deepseek-flash";
    if (modelId !== "deepseek-flash" && modelId !== "deepseek-v4-pro") {
      return {
        content: [
          {
            type: "text",
            text: `delegate: unknown model "${params.model}" (use deepseek-flash or deepseek-v4-pro)`,
          },
        ],
        details: { error: "invalid-model", model: params.model },
        isError: true,
      };
    }
    const model = ctx.modelRegistry.find("deepseek", modelId);
    if (!model) {
      return {
        content: [{ type: "text", text: `delegate: model deepseek/${modelId} is not available` }],
        details: { error: "model-not-found", modelId },
        isError: true,
      };
    }

    // lowest supported reasoning level for each tier
    const reasoning = modelId === "deepseek-v4-pro" ? "high" : "low";

    try {
      const stream = ctx.modelRegistry.streamSimple(
        model,
        {
          systemPrompt: params.role,
          messages: [{ role: "user", content: task, timestamp: Date.now() }],
        },
        { reasoning, maxTokens: 8_000, signal },
      );

      const message = await stream.result();
      const text = message.content
        .filter((block): block is TextContent => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (message.stopReason === "error" || message.errorMessage) {
        return {
          content: [{ type: "text", text: `delegate error: ${message.errorMessage ?? "unknown error"}` }],
          details: { error: message.errorMessage, modelId },
          isError: true,
          usage: message.usage,
        };
      }

      if (message.stopReason === "aborted") {
        return {
          content: [{ type: "text", text: "delegate aborted" }],
          details: { error: "aborted", modelId },
          isError: true,
          usage: message.usage,
        };
      }

      // Akin 2: operate when things go wrong — a truncated answer must never pass as complete.
      const truncated = message.stopReason === "length";
      const prefix = truncated
        ? "⚠ delegate: answer truncated (maxTokens) — treat as incomplete, re-ask with a narrower task.\n\n"
        : "";
      return {
        content: [{ type: "text", text: prefix + (text || "(empty response)") }],
        details: { modelId, stopReason: message.stopReason, truncated },
        usage: message.usage,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `delegate failed: ${error instanceof Error ? error.message : String(error)}` }],
        details: { error: String(error), modelId },
        isError: true,
      };
    }
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(delegateTool);
}
