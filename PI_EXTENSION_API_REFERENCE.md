# Справочник: Extension API, события, роутер, delegate

Справочник, а не учебник. Повествование и «почему» — в `PI_ZED_DEEPSEEK_MASTERY.md`,
разделы 11–12. Сюда — открывать, когда пишешь код.

Первоисточник: официальная `docs/extensions.md` установки pi (1.4.0). Таблицы ниже — выжимка
из неё и из исходников установленных расширений этой машины; листинги — файлы
`.pi/extensions/` этого репозитория (проверено по факту наличия).

## 1. ExtensionAPI — главные методы

| Метод | Назначение |
|---|---|
| `pi.registerTool(tool)` | LLM-вызываемый инструмент (`defineTool`) |
| `pi.registerCommand(name, {description, handler})` | `/команда` |
| `pi.registerShortcut(key, {handler})` / `pi.registerFlag(...)` | шорткаты / CLI-флаги |
| `pi.registerProvider(...)` / `pi.registerMcpServer(...)` | свой провайдер / MCP-сервер |
| `pi.registerVirtualModel({...})` | виртуальная модель-роутер |
| `pi.on(event, handler)` | подписка на события |
| `pi.sendMessage(...)` / `pi.sendUserMessage(...)` | сообщения агенту из кода |
| `pi.appendEntry(customType, data)` | долговечное состояние вне контекста |
| `pi.getActiveTools()` / `pi.setActiveTools([...])` | управление активными инструментами |
| `pi.getSettings()` / `pi.getCommands()` | настройки / команды |
| `pi.exec(cmd, args)` | shell из расширения |
| `pi.setModel(...)` / `pi.setThinkingLevel(...)` | смена модели/мышления |

## 2. События (выборочно)

`project_trust`, `session_start`/`_shutdown`/`_tree`, `session_before_compact`/`_fork`/`_switch`,
`agent_start`/`_end`/`_before_settle`/`_settled`, `turn_start`/`_end`,
`message_start`/`_update`/`_end`, `tool_call` (можно блокировать/мутировать), `tool_result`
(можно редактировать), `tool_execution_start`/`_update`/`_end`, `context` / `context_with_system`
(трансформация контекста), `before_provider_request`/`_headers`, `after_provider_response`,
`provider_stream_event`, `model_select`, `thinking_level_select`, `user_bash`, `input`.

Паттерн permission-gate (подтверждать опасные вызовы) — через `tool_call` + `pi.getAllTools()`
annotations (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`).

## 3. Контексты и ModelRegistry

`ExtensionContext` (события): `ui`, `mode`, `cwd`, `sessionManager`, `modelRegistry`, `model`,
`scopedModels`, `thinkingLevel`, `isIdle()`, `isProjectTrusted()`, `signal`, `abort()`,
`getContextUsage()`, `compact()`, `getSystemPrompt()`.

`ExtensionToolContext` (execute инструмента) = всё то же + `tools` + `executeTool(name, args,
opts)` (вложенные tool-вызовы, не попадают в транскрипт, учитываются в `nestedCalls`).

`ExtensionCommandContext` (команды) = + `waitForIdle()`, `newSession()`, `fork()`,
`navigateTree()`, `switchSession()`, `reload()`, `getSystemPromptOptions()`.

```text
ctx.modelRegistry.find(provider, id)                       // модель по id
ctx.modelRegistry.findOfType("classifier", p, id)          // классификатор
ctx.modelRegistry.complete(model, context, options?)       // Promise<AssistantMessage>
ctx.modelRegistry.streamSimple(model, context, options?)   // AssistantMessageEventStream (+ .result())
ctx.modelRegistry.classify(model, {state, questions})      // классификация
ctx.modelRegistry.generateImages(model, {input})           // генерация изображений
ctx.modelRegistry.registerVirtualModel(def)                // регистрация роутера
```

`Context = { systemPrompt?, messages: Message[], tools? }`; `Message` имеет `role` и `timestamp`.

## 4. Виртуальная модель: поля route(request, ctx)

| Поле request | Значение |
|---|---|
| `model`, `thinkingLevel` | выбранная виртуальная модель и уровень |
| `reason` | `user` / `continuation` / `retry` / `direct` |
| `previous` | физическая модель + уровень последнего успешного ответа |
| `failed` | для `retry`: физическая модель + уровень + message упавшего запроса |
| `state` | состояние роутера на ветке (JSON, переживает компакцию) |
| `messages` | конверсация запроса |
| `signal` | abort-сигнал |

Возврат: `{ model, thinkingLevel, state? }`. Нельзя роутить на другую виртуальную модель.

## 5. Codemode (JS-скрипты)

Включение: `"defaultTools": ["+codemode"]`. Глобальные: `tools.<name>(args)` (parallel-safe),
`text()`, `image()`, `console.log()`, `return`, `exit()`, `store(key,value)`/`load(key)`,
`ALL_TOOLS`, `searchTools(query)`, `describeTool(name)`, `describeNamespace(name)`, `models.*`.

Лимиты (сверено с `docs/codemode.md`): VM 256 MB; `max_output_tokens` по умолчанию 10000
(полный текст — во временный файл); нет Node/файловой системы/сети/таймеров.

## 6. Листинг: deepseek-router.ts (.pi/extensions/)

```typescript
import type {
  ExtensionAPI,
  ExtensionContext,
  ModelRoute,
  ModelRouteRequest,
} from "@earendil-works/pi-coding-agent";

const PROVIDER = "deepseek";
const FLASH = "deepseek-flash";
const PRO = "deepseek-v4-pro";

function routeTo(
  request: ModelRouteRequest,
  ctx: ExtensionContext,
  id: string,
  level: string,
): ModelRoute {
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
      // Продолжения/повторы (retry) остаются на предыдущей модели, чтобы кэш не сбрасывался.
      if (request.reason !== "user") {
        const sticky = request.failed ?? request.previous;
        if (sticky)
          return {
            model: sticky.model,
            thinkingLevel: sticky.thinkingLevel ?? "low",
          };
      }
      // Эскалация только по явному high/max.
      if (request.thinkingLevel === "high" || request.thinkingLevel === "max") {
        return routeTo(request, ctx, PRO, request.thinkingLevel);
      }
      return routeTo(request, ctx, FLASH, "low");
    },
  });
}
```

## 7. Листинг: delegate.ts (.pi/extensions/)

```typescript
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
    role: Type.String({
      description: "System prompt / persona for the sub-agent.",
    }),
    task: Type.String({ description: "The focused task or question." }),
    model: Type.Optional(
      Type.String({
        description: "deepseek-flash (default) or deepseek-v4-pro.",
      }),
    ),
  }),

  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    const modelId =
      params.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-flash";
    const model = ctx.modelRegistry.find("deepseek", modelId);
    if (!model) {
      return {
        content: [
          {
            type: "text",
            text: `delegate: model deepseek/${modelId} is not available`,
          },
        ],
        details: { error: "model-not-found", modelId },
        isError: true,
      };
    }
    const reasoning = modelId === "deepseek-v4-pro" ? "high" : "low";
    try {
      const stream = ctx.modelRegistry.streamSimple(
        model,
        {
          systemPrompt: params.role,
          messages: [
            { role: "user", content: params.task, timestamp: Date.now() },
          ],
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
          content: [
            {
              type: "text",
              text: `delegate error: ${message.errorMessage ?? "unknown"}`,
            },
          ],
          details: { error: message.errorMessage, modelId },
          isError: true,
          usage: message.usage,
        };
      }
      return {
        content: [{ type: "text", text: text || "(empty response)" }],
        details: { modelId, stopReason: message.stopReason },
        usage: message.usage,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `delegate failed: ${String(error)}` }],
        details: { error: String(error), modelId },
        isError: true,
      };
    }
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(delegateTool);
}
```

Ключевые идеи delegate: `ctx.modelRegistry.find` → модель; `streamSimple` +
`await stream.result()` → финальный `AssistantMessage`; `usage` пробрасывается в результат,
чтобы сессия корректно считала стоимость субагента; валидация на границе и явная ошибка при
обрыве/аборте вместо молчаливого «(empty response)».

## 8. Subagent: формат файла агента и лимиты (сверено с исходником)

Файл агента — Markdown с YAML-шапкой: `name`, `description`, `tools` (строка или список),
`model` (формат `provider/id`; нет поля — наследует модель и уровень мышления родительской
сессии, `inheritsDispatchConfig = !agent.model`). Личные агенты — `~/.pi/agent/agents/*.md`,
проектные — `.pi/agents/*.md` (`agentScope: "project" | "both"`).

Лимиты parallel-режима (константы в исходнике): `MAX_PARALLEL_TASKS = 8`,
`MAX_CONCURRENCY = 4`. Прерывание: abort → дочернему процессу SIGTERM, через 5 с SIGKILL.
