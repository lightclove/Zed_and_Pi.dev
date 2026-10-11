# Pi.dev + DeepSeek + Zed — концептуальный мастер-гайд

> Цель этого документа — зафиксировать **всё**, что разобрано в рабочей сессии, чтобы по нему можно было
> учиться и быстро выйти на профессиональный уровень: pi.dev, бережливая трата токенов, суперэффективная
> оркестрация агентов. Ничего не упущено — от диагноза системы до API-справочника.

## Содержание

1. [Твоё текущее состояние (диагноз)](#1-твоё-текущее-состояние-диагноз)
2. [Ментальная модель pi](#2-ментальная-модель-pi)
3. [DeepSeek: модели, цены, кэш](#3-deepseek-модели-цены-кэш)
4. [Бережливая трата токенов](#4-бережливая-трата-токенов)
5. [Оркестрация агентов: иерархия примитивов](#5-оркестрация-агентов-иерархия-примитивов)
6. [«Суперинтеллектуальная обвязка» агентов](#6-суперинтеллектуальная-обвязка-агентов)
7. [Что уже создано в проекте](#7-что-уже-создано-в-проекте)
8. [API-справочник для своих расширений](#8-api-справочник-для-своих-расширений)
9. [MCP-серверы](#9-mcp-серверы)
10. [Справочник: команды и хоткеи](#10-справочник-команды-и-хоткеи)
11. [Zed](#11-zed)
12. [Пайплайн «идея → прод»](#12-пайплайн-идея--прод)
13. [Cheat sheet](#13-cheat-sheet)
14. [Переход с GUI на pi: базовая работа в терминале](#14-переход-с-gui-на-pi-базовая-работа-в-терминале)
15. [Дорожная карта освоения](#15-дорожная-карта-освоения)
16. [Практика 2026-10-11: субагенты, стоимость, настройки](#16-практика-2026-10-11-субагенты-стоимость-настройки)

---

## 1. Твоё текущее состояние (диагноз)

| Факт | Статус |
|---|---|
| pi | ✅ установлен, **v1.1.0** (релизы 0.87.1 → 1.1.0 в `~/.pi/agent/install/releases/`) |
| DeepSeek | ✅ подключён: `~/.pi/agent/settings.json` → `defaultModel: "deepseek-flash"`, `defaultThinkingLevel: "low"` |
| Ключ DeepSeek | env-переменная `DEEPSEEK_API_KEY` (или `/login deepseek`) |
| Shell-инструмент `bash` | ✅ работает (Git Bash установлен) |
| Zed | ✅ конфиг в `C:\Users\admin\AppData\Roaming\Zed\` (`settings.json`, `keymap.json`) |
| Zed-агент | настроен на `deepseek-reasoner` (дорогая reasoning-модель) |

### Критический фикс №1 — Git Bash

pi на нативной Windows выполняет `bash`-команды через Git Bash. Без него агент не может запускать
shell-команды (я в этой сессии физически не мог выполнять `bash`, только читать/писать файлы).

```text
1. Установи Git for Windows: https://git-scm.com/download/win
2. В pi введи:  !printf 'Bash works\n'
3. Если не подхватилось — в ~/.pi/agent/settings.json:
   "shellPath": "C:\\Program Files\\Git\\bin\\bash.exe"   (путь уточни по установке)
```

Проверка ключа и моделей:

```bash
pi auth check --provider deepseek --json
pi --list-models deepseek
```

---

## 2. Ментальная модель pi

**pi — минимальный расширяемый агент для терминала.** Главная идея: «подстрой pi под свой рабочий
процесс, а не наоборот». Всё, что ты привык видеть «встроенным» в Cursor, здесь собирается из
маленьких примитивов.

### 2.1 Agent loop (цикл агента)

```
сообщение пользователя → собирается запрос = системный промпт + активная ветка истории
                        + описания инструментов + настройки модели
→ стрим ответа модели (текст + tool calls)
→ pi выполняет каждый tool call и записывает результат
→ если нужен следующий шаг (tool results / очередь сообщений) → новый ход
→ иначе — конец ран-цикла
```

- **Steering** (`Enter`) — сообщение встаёт после текущего хода и корректирует задачу.
- **Follow-up** (`Alt+Enter` / на Windows `Ctrl+Q`) — сообщение ждёт, пока агент завершит текущую задачу.
- **Abort** (`Escape`) — останавливает текущий ран, сообщения возвращаются в редактор.

### 2.2 Контекст

- Контекст строится из **активной ветки** сессии + системного промпта + описаний инструментов + описаний skills.
- Системный промпт = базовые инструкции pi + обнаруженные контекст-файлы (`AGENTS.md`, `CLAUDE.md`, `AGENTS.override.md`).
- **Skills** анонсируются именем+описанием, а полные инструкции грузятся **по требованию**.
- Расширения могут добавлять инструкции или трансформировать контекст.

### 2.3 Сессии — это дерево (tree)

- Сессия = JSONL-файл; сообщения и события образуют **дерево**; путь по дереву = **ветка (branch)**.
- Активная ветка даёт историю для следующего запроса.
- `/tree` — навигация по дереву, `/fork` — ответвление, `/clone` — копия в новую сессию.
- **Компакция** вставляет summary-запись, которая заменяет старые сообщения в последующих запросах
  (оригинал остаётся в дереве).
- Продолжить с ранней точки = новая ветка в том же файле. Резюм сессии **сохраняет префикс → кэш-хиты**.

### 2.4 Интерфейсы (5 режимов)

| Режим | Как | Для чего |
|---|---|---|
| Interactive (TUI) | `pi` | ежедневная работа |
| Print | `pi --print "..."` | одноразовые/скриптовые задачи, пайплайны |
| JSON event stream | `pi --mode json "..."` | потребление структурированных событий |
| RPC | `pi --mode rpc` | управление отдельным процессом pi |
| TypeScript SDK | `@earendil-works/pi-coding-agent` | встраивание агента в приложение |

Все режимы используют один и тот же агент и механизм сессий.

### 2.5 Расширения и ресурсы

| Ресурс | Что делает |
|---|---|
| **Extension** (`.ts`) | исполняемое поведение: инструменты, команды, провайдеры, события, TUI |
| **Skill** (`SKILL.md`) | инструкции + файлы, грузятся по требованию |
| **Prompt template** (`.md`) | переиспользуемый текст → `/команда` |
| **Theme** | цвета терминала |
| **Pi package** | npm/git-дистрибутив набора ресурсов |

### 2.6 Доверие и права

- Проектный `.pi/` загружается **только после trust** (pi спрашивает при первом запуске в папке).
- Инструменты работают с правами процесса pi — **песочницы нет**. Не доверяй чужим репозиториям/расширениям.
- `--approve` / `--no-approve` — принудительный trust на один запуск.

---

## 3. DeepSeek: модели, цены, кэш

Из актуального каталога pi (провайдер `deepseek`, base URL `https://api.deepseek.com`, `api: openai-completions`):

| | `deepseek-flash` (V4.1 Flash) | `deepseek-v4-pro` (V4 Pro) |
|---|---|---|
| Input (промах кэша) | **$0.30 / 1M** | $1.32 / 1M |
| Input (попадание кэша, `cacheRead`) | **$0.006 / 1M** (×50 дешевле) | $0.044 / 1M (×30 дешевле) |
| Output | **$1.20 / 1M** | $3.96 / 1M |
| Запись в кэш (`cacheWrite`) | **$0** | $0 |
| Контекст / max output | 1M / 384k | 1M / 384k |
| Вход | текст + **изображения** | только текст |
| Уровни мышления | `low` / `high` / `max` | только `high` / `max` |

### 3.1 Механика кэша (ключевой экономический рычаг)

- DeepSeek кэширует **префикс запроса на своей стороне автоматически** — никаких `cache_control`-маркеров не нужно.
- **Запись в кэш бесплатна** (`cacheWrite = 0`) — в отличие от Anthropic/OpenAI, где запись дороже обычного ввода.
- Попадание в кэш в **30–50 раз дешевле** промаха. Значит главный закон экономии: **держи стабильный префикс**
  (системный промпт + AGENTS.md + набор инструментов + история) и не переключай модель/инструменты посреди задачи.
- Reasoning-токены **остаются в контексте** (`requiresReasoningContentOnAssistantMessages: true`) — они
  пересылаются как часть истории и тарифицируются как output.

### 3.2 Три вывода

1. **Кэш-промах vs попадание = ×30–50.** Стабильный префикс — твой главный актив.
2. **Output (включая reasoning) дороже input в 3–4 раза.** Проси краткие ответы, держи thinking низким.
3. **flash в ~4.4× дешевле pro по input и в 3.3× по output** и при этом мультимодальная → рабочая лошадка.

### 3.3 Важное замечание про имена моделей

Zed у тебя настроен на `deepseek-chat` / `deepseek-reasoner` (классические ID публичного API), а каталог pi
использует `deepseek-flash` / `deepseek-v4-pro`. Сверься с `api-docs.deepseek.com` и обнови каталог pi:
`pi update --models`. Оба набора могут быть валидными алиасами — проверь на своём ключе.

---

## 4. Бережливая трата токенов

### 4.1 Принципы (AI/ML-инженерный минимум)

1. **Контекст — единица стоимости.** Сначала `find`/`grep`/`ls`, потом `read` только нужных диапазонов
   (`offset`/`limit`). Никогда не дампь репозиторий целиком.
2. **Локальность кэша.** Не меняй модель/thinking/набор инструментов в середине задачи — каждый switch =
   промах кэша = ×30–50 по вводу на следующем запросе.
3. **Тиринг моделей.** `flash` для 90% токенов, `pro` — только для архитектуры/отладки/безопасности.
4. **Бюджет reasoning.** `low` по умолчанию. Reasoning = output-токены, дорогие и накапливаются в контексте.
5. **Компакция.** Окно 1M — не свалка. `/compact` при разрастании; короткая история = дешёвый префикс.
6. **Фильтруй вывод инструментов.** `codemode` режет/агрегирует результат до попадания в контекст.
7. **Параллель вместо последовательности.** Каждый round-trip пересылает весь контекст. Один `codemode`
   с 5 параллельными чтениями лучше 5 последовательных шагов.
8. **Измеряй, а не верь.** Футер (usage/cost), `/session` (стоимость по каждой модели), `showCacheMissNotices`.
9. **Fork/continue вместо рестарта.** Резюм сохраняет префикс → кэш-хиты с первого запроса.
10. **Точечные правки.** `edit` с маленьким `oldText` вместо перезаписи файла целиком.

### 4.2 Настройки, влияющие на токены (settings.json)

```jsonc
{
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-flash",        // рабочая лошадка
  "defaultThinkingLevel": "low",           // reasoning-бюджет по умолчанию
  "hideThinkingBlock": true,               // не рендерить thinking-блоки
  "showCacheMissNotices": true,            // видеть промахи кэша
  "defaultTools": ["+grep", "+find", "+ls", "+codemode", "+tool_search"],
  "compaction": { "enabled": true, "reserveTokens": 16384, "keepRecentTokens": 20000 }
}
```

Ключевые поля (полный список в `docs/settings.md`):

- **Модель/мышление:** `defaultProvider`, `defaultModel`, `defaultThinkingLevel`, `modelThinkingLevels`,
  `thinkingBudgets`, `enabledModels`, `hideThinkingBlock`, `showCacheMissNotices`, `cacheWarming` (`off|streaming|idle`).
- **Инструменты:** `defaultTools` (plain = замена, `+name` = добавить, `-name` = убрать), `codemode.mode`,
  `codemode.inlineBudget`.
- **Компакция:** `compaction.enabled`, `compaction.reserveTokens` (16384), `compaction.keepRecentTokens` (20000),
  `compaction.modelOverrides`, `branchSummary.reserveTokens`.
- **Терминал:** `tuiMode` (`fullscreen|regular`), `fullscreenWheelScrollLines`, `fullscreenCopyOnSelect`,
  `fullscreenScrollbar`, `theme`, `quietStartup`.
- **Сеть/ретраи:** `transport`, `retry.enabled`, `retry.maxRetries` (3), `retry.provider.maxRetries` (0 —
  держи 0, чтобы pi сам обрабатывал квоты), `httpProxy`.
- **Shell:** `shellPath`, `shellCommandPrefix`, `npmCommand`.
- **Ресурсы:** `extensions`, `skills`, `prompts`, `themes`, `packages`, `enableSkillCommands`.

### 4.3 DeepSeek + cacheWarming (опционально)

`cacheWarming` (подогрев кэша в простое/потоке) работает только для моделей с объявленным `promptCache`
(время жизни кэша в секундах). У DeepSeek-моделей в каталоге его нет, поэтому подогрев по умолчанию не
активен. Сам автокэш DeepSeek работает и без этого. Если захочешь включить подогрев — задай через
`modelOverrides` в `models.json` консервативный TTL (см. `docs/models.md`), но сначала проверь реальный TTL
кэша DeepSeek в их документации.

---

## 5. Оркестрация агентов: иерархия примитивов

В pi **нет встроенных** субагентов как в Cursor — из коробки оркестрация собирается из примитивов.
Однако есть официальный пример-расширение `subagent` (установлено, см. §16.4) и проектное расширение
`delegate` (§7.2). Правило выбора: **начни с наименее мощного механизма, которого достаточно.**

| Нужно | Примитив | Где |
|---|---|---|
| Постоянные инструкции для папки | `AGENTS.md` | корень проекта / `~/.pi/agent/` |
| Переиспользуемый промпт из `/` | Prompt template | `.pi/prompts/*.md` |
| Инструкции + файлы под тип задачи | Skill | `.pi/skills/*/SKILL.md` |
| Маршрутизация запросов между моделями | Virtual model | extension `registerVirtualModel` |
| Исполняемый инструмент/команда/событие | Extension | `.pi/extensions/*.ts` |
| Изолированные субагенты (как в Cursor) | Extension `subagent` (офиц. пример) | `~/.pi/agent/extensions/subagent/` (§16.4) |
| Параллельные tool-вызовы + фильтрация вывода | codemode | встроенный (`+codemode`) |
| Внешние инструменты (GitHub, БД, docs) | MCP server | `mcp.json` |
| Дистрибутив набора ресурсов | Pi package | `pi install` |

### Уровни оркестрации

- **Уровень 0 — один агент + тиринг моделей.** Один «мозг», адаптивная стоимость: виртуальная модель
  `deepseek/auto` сама выбирает `flash`/`pro` по уровню мышления. Профит: кэш-локальность, ноль ручного
  переключения.
- **Уровень 1 — специалисты на запрос.** Skills и prompt-шаблоны (`/plan`, `/review`, `/ship`, `code-review`)
  дают экспертизу только когда нужно — без постоянной платы за контекст.
- **Уровень 2 — изолированные субагенты.** Два механизма: инструмент `subagent` (официальный
  пример-расширение: отдельный процесс pi, режимы single/parallel/chain — §16.4) и проектное `delegate`
  (§7.2, вложенный DeepSeek-вызов). Оба изолируют контекст: параллельная независимая работа
  (research/review/plan) не загрязняет главный контекст.
- **Уровень 3 — исполняемые агенты.** Extension-инструменты могут вызывать другие инструменты
  (`ctx.executeTool`) и делать вложенные LLM-вызовы (`ctx.modelRegistry.streamSimple`). Это и есть
  «агент как код».
- **Уровень 4 — процессная оркестрация.** Несколько `pi --print`/`--mode json`/RPC/SDK-процессов
  параллельно — пайплайны, CI, многомодульная разработка.

---

## 6. «Суперинтеллектуальная обвязка» агентов

Термин, под которым понимаем **умное соединение агентов** — маршрутизация, эскалация, делегирование,
общее состояние, события, параллельные пайплайны. Эталонная архитектура:

```
                         ┌──────────────────────────────┐
                         │  ОРКЕСТРАТОР (pi, interactive)│
                         │  модель: deepseek/auto         │
                         └──────────────┬───────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
   /plan (шаблон)   delegate(...)   skills        codemode       MCP-инструменты
   планирование    субагенты      экспертиза    параллельные    внешний мир
                                     по запросу   tool-вызовы    (GitHub/БД/docs)
        └───────────────┴───────────────┴───────────────┴───────────────┘
                                        │
                        ┌───────────────▼───────────────┐
                        │  РОУТЕР deepseek/auto          │
                        │  low → flash, high/max → pro   │
                        │  продолжения прилипают (кэш)   │
                        └───────────────────────────────┘
```

Принципы «обвязки»:

1. **Один выбор модели — умная диспетчеризация.** Пользователь выбирает `deepseek/auto`, а роутер решает
   физическую модель на каждый запрос. Кэш-локальность важнее «оптимального» выбора на каждом шаге.
2. **Стики-роутинг.** Продолжения/ретраи остаются на той же модели (иначе каждый tool-шаг = промах кэша).
3. **Изоляция контекста через делегирование.** Независимая работа — в субагенте с собственным промптом,
   результат возвращается одной строкой. Экономия = главный контекст не раздувается.
4. **Состояние через дерево сессии.** Роутер хранит фазу в `state` (следует за веткой, переживает компакцию);
   расширения хранят данные в `details` tool-результатов или `appendEntry`.
5. **События вместо поллинга.** `pi.on(...)` (agent/tool/session/message события) для реакций и гейтов.
6. **Параллельность через codemode / процессы.** Независимые чтения и greps — в `Promise.allSettled`;
   независимые задачи — в параллельные `pi --print`.
7. **Экспертная эскалация.** Классификаторы (`models.classify`, напр. TypeSafe Jev) могут выбирать модель
   по сложности задачи без ручного вмешательства (паттерн `jev-router.ts`).

---

## 7. Что уже создано в проекте

Расположение: `C:\Users\admin\Work\Zed_and_Pi.dev\`

```
AGENTS.md                         ← конвенции + правила token-economy
.pi/settings.json                 ← +grep/find/ls, +codemode, +tool_search, hideThinkingBlock, кэш-нотисы
.pi/extensions/deepseek-router.ts ← виртуальная модель deepseek/auto (flash↔pro)
.pi/extensions/delegate.ts        ← инструмент delegate (изолированные субагенты, валидация на границе, флаги обрыва/аборта)
.pi/prompts/plan.md               ← /plan (+ гейты Гамильтон/Акин)
.pi/prompts/review.md             ← /review (+ гейты Гамильтон/Акин)
.pi/prompts/ship.md               ← /ship (+ numbers gate, Акин 1/26)
.pi/skills/code-review/           ← skill code-review (+ references/checklist.md)
.pi/skills/engineering-principles/ ← skill: принципы Гамильтон + законы Акина (+ references/)
```

При первом запуске `pi` в папке — подтверди trust, затем `/reload`.

### 7.1 Роутер (эталонный код)

```ts
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
      // Продолжения/ретраи прилипают к модели, чтобы кэш не сбрасывался.
      if (request.reason !== "user") {
        const sticky = request.failed ?? request.previous;
        if (sticky) return { model: sticky.model, thinkingLevel: sticky.thinkingLevel ?? "low" };
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

Использование: `/model deepseek/auto`, эскалация `/thinking` (или `Shift+Tab`).

### 7.2 Delegate (эталонный код субагента)

```ts
import { Type, type TextContent } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const delegateTool = defineTool({
  name: "delegate",
  label: "Delegate",
  description:
    "Run an isolated DeepSeek sub-agent with its own system prompt and a focused task. " +
    "Use for independent work (planning, reviewing, researching) without polluting the main context.",
  parameters: Type.Object({
    role: Type.String({ description: "System prompt / persona for the sub-agent." }),
    task: Type.String({ description: "The focused task or question." }),
    model: Type.Optional(Type.String({ description: "deepseek-flash (default) or deepseek-v4-pro." })),
  }),

  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    const modelId = params.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-flash";
    const model = ctx.modelRegistry.find("deepseek", modelId);
    if (!model) {
      return { content: [{ type: "text", text: `delegate: model deepseek/${modelId} is not available` }],
               details: { error: "model-not-found", modelId }, isError: true };
    }
    const reasoning = modelId === "deepseek-v4-pro" ? "high" : "low";
    try {
      const stream = ctx.modelRegistry.streamSimple(
        model,
        { systemPrompt: params.role,
          messages: [{ role: "user", content: params.task, timestamp: Date.now() }] },
        { reasoning, maxTokens: 8_000, signal },
      );
      const message = await stream.result();
      const text = message.content
        .filter((block): block is TextContent => block.type === "text")
        .map((block) => block.text).join("\n").trim();
      if (message.stopReason === "error" || message.errorMessage) {
        return { content: [{ type: "text", text: `delegate error: ${message.errorMessage ?? "unknown"}` }],
                 details: { error: message.errorMessage, modelId }, isError: true, usage: message.usage };
      }
      return { content: [{ type: "text", text: text || "(empty response)" }],
               details: { modelId, stopReason: message.stopReason }, usage: message.usage };
    } catch (error) {
      return { content: [{ type: "text", text: `delegate failed: ${String(error)}` }],
               details: { error: String(error), modelId }, isError: true };
    }
  },
});

export default function (pi: ExtensionAPI) { pi.registerTool(delegateTool); }
```

Ключевые идеи кода: `ctx.modelRegistry.find` → модель; `streamSimple` + `await stream.result()` → финальный
`AssistantMessage`; `usage` пробрасывается в результат, чтобы сессия корректно считала стоимость субагента.

### 7.3 Инженерные принципы (Гамильтон + Акин)

В harness вшиты принципы Маргарет Гамильтон (Apollo: ошибки ловятся на самой ранней стадии, система
работает, когда что-то сломано, ошибки мигрируют к интерфейсам) и законы Акина (инженерия — это числа,
Shea: улучшения — на интерфейсах, «better — враг good», YAGNI и т.д.):

- **Skill `engineering-principles`** — полный свод (H1–H5, A1–A29) + reference-файлы с цитатами;
  загружается, когда агент планирует архитектуру, проектирует интерфейсы или гейтит изменение.
- **AGENTS.md** — 7 всегда-в-контексте правил (fail early, error paths, числа вместо мнений, YAGNI, …).
- **Промпты** — `/plan` (допущения, дешёвые проверки, альтернативы), `/review` (гейты H1/H3/A2/A16/A19),
  `/ship` (numbers gate: тесты/типчек/стоимость, затем финальный sanity-проход — Акин 26).
- **`delegate.ts`** — код, следующий принципам: валидация параметров на границе вместо тихого дефолта
  (Гамильтон), явная ошибка при обрыве/аборте вместо «(empty response)» (Акин 2).

---

## 8. API-справочник для своих расширений

Расширение — TypeScript-модуль с default-фабрикой `(pi: ExtensionAPI) => void`. Pi использует `jiti`,
компиляция не нужна. Файлы: `~/.pi/agent/extensions/` (глобально) или `.pi/extensions/` (проект).

### 8.1 ExtensionAPI (главные методы)

| Метод | Назначение |
|---|---|
| `pi.registerTool(tool)` | LLM-вызываемый инструмент (`defineTool`) |
| `pi.registerCommand(name, {description, handler})` | `/команда` |
| `pi.registerShortcut(key, {handler})` / `pi.registerFlag(...)` | шорткаты / CLI-флаги |
| `pi.registerProvider(...)` / `pi.registerMcpServer(...)` | свой провайдер / MCP-сервер |
| `pi.registerVirtualModel({...})` | виртуальная модель-роутер |
| `pi.on(event, handler)` | подписка на события (см. ниже) |
| `pi.sendMessage(...)` / `pi.sendUserMessage(...)` | сообщения агенту из кода |
| `pi.appendEntry(customType, data)` | долговечное состояние вне контекста |
| `pi.getActiveTools()` / `pi.setActiveTools([...])` | управление активными инструментами |
| `pi.getSettings()` / `pi.getCommands()` | настройки / команды |
| `pi.exec(cmd, args)` | shell из расширения |
| `pi.setModel(...)` / `pi.setThinkingLevel(...)` | смена модели/мышления |

### 8.2 События (выборочно)

`project_trust`, `session_start/_end/_shutdown/_tree`, `session_before_compact/_fork/_switch`,
`agent_start/_end/_before_settle/_settled`, `turn_start/_end`, `message_start/_update/_end`,
`tool_call` (можно блокировать/мутировать), `tool_result` (можно редактировать/редиктить),
`tool_execution_start/_update/_end`, `context` / `context_with_system` (трансформация контекста),
`before_provider_request/_headers`, `after_provider_response`, `provider_stream_event`,
`model_select`, `thinking_level_select`, `user_bash`, `input`.

Паттерн permission-gate (подтверждать опасные вызовы) — через `tool_call` + `pi.getAllTools()` annotations
(`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`).

### 8.3 Контексты

- **ExtensionContext** (события): `ui`, `mode`, `cwd`, `sessionManager`, `modelRegistry`, `model`,
  `scopedModels`, `thinkingLevel`, `isIdle()`, `isProjectTrusted()`, `signal`, `abort()`,
  `getContextUsage()`, `compact()`, `getSystemPrompt()`.
- **ExtensionToolContext** (execute инструмента) = ExtensionContext + `tools` + `executeTool(name, args, opts)`
  (вложенные tool-вызовы, не попадают в транскрипт, учитываются в `nestedCalls`).
- **ExtensionCommandContext** (команды) = + `waitForIdle()`, `newSession()`, `fork()`, `navigateTree()`,
  `switchSession()`, `reload()`, `getSystemPromptOptions()`.

### 8.4 ModelRegistry (вложенные LLM-вызовы)

```ts
ctx.modelRegistry.find(provider, id)                       // модель по id
ctx.modelRegistry.findOfType("classifier", p, id)          // классификатор
ctx.modelRegistry.complete(model, context, options?)       // Promise<AssistantMessage>
ctx.modelRegistry.streamSimple(model, context, options?)   // AssistantMessageEventStream (+ .result())
ctx.modelRegistry.classify(model, {state, questions})      // классификация
ctx.modelRegistry.generateImages(model, {input})           // генерация изображений
ctx.modelRegistry.registerVirtualModel(def)                // регистрация роутера
```

`Context` = `{ systemPrompt?, messages: Message[], tools? }`. `Message` имеет `role` и `timestamp`.

### 8.5 Виртуальная модель: поля `route(request, ctx)`

| Поле `request` | Значение |
|---|---|
| `model`, `thinkingLevel` | выбранная виртуальная модель и уровень |
| `reason` | `user` / `continuation` / `retry` / `direct` |
| `previous` | физическая модель+уровень последнего успешного ответа |
| `failed` | для `retry`: физическая модель+уровень+message упавшего запроса |
| `state` | состояние роутера на ветке (JSON, переживает компакцию) |
| `messages` | конверсация запроса |
| `signal` | abort-сигнал |

Возврат: `{ model, thinkingLevel, state? }`. Нельзя роутить на другую виртуальную модель.

### 8.6 Codemode (JS-скрипты)

Включение: `"defaultTools": ["+codemode"]`. Модель пишет JS, который вызывает инструменты и не-LLM модели;
в контекст попадает только вывод скрипта.

Глобальные: `tools.<name>(args)` (parallel-safe), `text()`, `image()`, `console.log()`, `return`,
`exit()`, `store(key,value)`/`load(key)` (мелкое состояние между вызовами), `ALL_TOOLS`,
`searchTools(query)`, `describeTool(name)`, `describeNamespace(name)`, `models.*`.

```js
// @options: {"max_output_tokens": 2000, "timeout_ms": 60000}
const [a, b, c] = await Promise.allSettled([
  tools.grep({ pattern: "TODO" }),
  tools.find({ pattern: "**/*.spec.ts" }),
  tools.read({ path: "src/main.ts", offset: 1, limit: 200 }),
]);
return [a, b, c].map(r => r.status === "fulfilled" ? r.value : "ERR");
```

`bash` в скриптах возвращает `{ output, truncated, full_output_path?, exit_code, wall_time_seconds }`.
Лимиты: 256MB памяти, `max_output_tokens` 10000 по умолчанию, нет Node/сети/таймеров.

---

## 9. MCP-серверы

Подключение внешних инструментов (GitHub, БД, документация, filesystem).

```bash
pi mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem .
pi mcp add docs --url https://example.com/mcp --bearer-token-env-var DOCS_TOKEN
pi mcp list          # проверка
```

Конфиг: `~/.pi/agent/mcp.json` (глобально) или `.pi/mcp.json` (проект). Формат — стандартный `mcpServers`:

```jsonc
{ "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "."] },
    "github":     { "url": "https://api.githubcopilot.com/mcp/", "exposure": "deferred" }
} }
```

**Exposure** (как модель достигает инструментов сервера):

| Режим | Поведение | Когда |
|---|---|---|
| `codemode` (default) | вызывается из codemode-скриптов, модели не декларируется | общие серверы, объединять/фильтровать вызовы |
| `deferred` | не декларируется, пока `tool_search` не найдёт совпадение | большие серверы |
| `direct` | декларируется модели как обычный инструмент | маленькие частые наборы |
| `hidden` | зарегистрирован, но недоступен | выключить/секретные |

`toolExposure` переопределяет exposure для отдельных инструментов (ключи = имена, `*` — wildcard).
Инструменты именуются `mcp__<server>__<tool>`. Внутри сессии — `/mcp` (статус, sign-in, exposure).

---

## 10. Справочник: команды и хоткеи

### 10.1 Slash-команды (вводятся в редакторе)

| Команда | Действие |
|---|---|
| `/login` / `/logout` | управление доступом к провайдерам |
| `/model` | выбор модели (`Ctrl+L`) |
| `/thinking` | уровень мышления (`Shift+Tab`) |
| `/settings` | частые настройки |
| `/reload` | перезагрузка конфига/расширений после правок |
| `/new` / `/resume` / `/name` / `/session` | сессии |
| `/tree` / `/fork` / `/clone` | дерево / ветвление |
| `/compact` | сжать историю |
| `/mcp` | статус MCP |
| `/skill:name` | принудительно загрузить skill |
| `/share` / `/export` / `/copy` | поделиться / экспорт / копия |
| `/debug` / `/hotkeys` | диагностика / активные шорткаты |
| `/scoped-models` | управление циклом моделей |

### 10.2 Хоткеи fullscreen (Windows)

| Действие | Клавиша |
|---|---|
| Прокрутка транскрипта на страницу | `PageUp` / `PageDown` |
| **Вниз + следовать за выводом (автоскролл)** | **`End`** |
| В начало транскрипта | `Home` |
| След./пред. сообщение | `Ctrl+Down` / `Ctrl+Up` |
| Поиск по транскрипту | `Ctrl+F` |
| Развернуть/свернуть вывод инструмента | `Ctrl+O` |
| Свернуть/развернуть thinking | `Ctrl+T` |
| Выбор модели | `Ctrl+L` |
| Цикл моделей | `Ctrl+P` / `Alt+P` (назад) |
| Открыть во внешнем редакторе | `Ctrl+G` |
| Копировать последний ответ | `Ctrl+X` |
| Follow-up / вернуть в редактор | `Ctrl+Q` / `Alt+Q` |
| Выход (пустой редактор) | `Ctrl+D` |
| Прервать | `Escape` |
| Отмена ввода / выход | `Ctrl+C` |

`/hotkeys` — актуальный список. Правки — в `~/.pi/agent/keybindings.json` (id действия → клавиша),
потом `/reload`. Пример: `{"tui.altScreen.lineUp": "alt+up"}`.

### 10.3 CLI (главное)

```bash
pi                                   # interactive TUI
pi --print "..."                     # одноразовый запуск
pi --mode json "..." > events.jsonl  # структурированные события
pi --mode rpc                        # управление процессом
pi --continue / --resume / --session <id> / --fork <id> / --no-session
pi --model deepseek/deepseek-flash --thinking low   # выбор модели+уровня
pi --models "deepseek/*" --list-models deepseek
pi --tools read,bash,edit,write,codemode  # набор инструментов
pi -e ./ext.ts --skill ./skill --prompt-template ./p.md
pi --append-system-prompt ./rules.md --system-prompt ./sys.md
pi --tui-mode regular --offline
pi install <src> / pi remove <src> / pi update [--all|--models] / pi list / pi config
pi auth check --provider deepseek --json
pi mcp add|remove|list|login|logout
```

### 10.4 Environment-переменные

| Переменная | Назначение |
|---|---|
| `DEEPSEEK_API_KEY` | ключ провайдера |
| `PI_CODING_AGENT_DIR` | переопределить каталог конфига (default `~/.pi/agent`) |
| `PI_OFFLINE` | без сети (без обновления каталога) |
| `PI_CACHE_RETENTION` | `long` — расширенное кэширование провайдера |
| `PI_HARDWARE_CURSOR` | показать аппаратный курсор (IME в WSL) |
| `PI_HYPERLINKS` / `PI_IMAGE_PROTOCOL` / `PI_TRUE_COLOR` | переопределить детекцию терминала |
| `VISUAL` / `EDITOR` | внешний редактор (fallback) |
| `HTTP_PROXY` / `HTTPS_PROXY` | прокси |

Маркеры для дочерних процессов: `AI_AGENT=pi`, `PI_CODING_AGENT=true`; shell-инструментам передаются
`PI_SESSION_ID`, `PI_SESSION_FILE`, `PI_PROVIDER`, `PI_MODEL`, `PI_REASONING_LEVEL`.

---

## 11. Zed

**Философия:** Zed = редактор + git-клиент, pi = оркестратор в терминале. Не пытайся выжать оркестрацию из
Zed — его сила в скорости редактирования и ревью диффов.

### 11.1 Конфиг

- Каталог: `C:\Users\admin\AppData\Roaming\Zed\` (`settings.json`, `keymap.json`).
- Открыть: `zed: open settings`, `zed: open keymap` (путь руками искать не надо).
- `keymap.json` — **массив** объектов `[{ "context": "...", "bindings": {...} }]`.

### 11.2 Что выучить в первую очередь

- **Multi-buffer:** `Ctrl+Shift+F` (поиск по проекту) → результат — редактируемый буфер (массовый rename).
- **Vim mode:** `"vim_mode": true` в settings.
- **Мультикурсор** (`Alt+Click`, `Ctrl+D`), **split-панели**, **outline** (символы файла).
- **Inline git / диффы:** `editor: toggle git blame` (кто менял строку), gutter-метки изменённых строк,
  git panel (`Ctrl+Shift+G`). Разбор «что именно изменил агент» — см. **§14.10**.
- **Терминал:** `Ctrl+\`` — запускай `pi` прямо там.
- **Интеграция с pi:** `"externalEditor": "zed --wait"` в `~/.pi/agent/settings.json` → `Ctrl+G` в pi
  откроет промпт в Zed (сначала `zed: install cli`).

### 11.3 Zed-терминал: проброс клавиш в pi

Созданный `keymap.json` (чинит `Shift+Enter`, `Ctrl+-`, `Ctrl+Alt+]`):

```jsonc
[
  { "context": "Terminal",
    "bindings": {
      "shift-enter": ["terminal::SendText", "\u001b[13;2u"],
      "ctrl--":      ["terminal::SendText", "\u001b[45;5u"],
      "ctrl-alt-]":  ["terminal::SendText", "\u001b[93;7u"]
    } }
]
```

Zed подхватывает `keymap.json` автоматически. `Ctrl+Shift+P` → `zed: reload keymap`, если нет.

### 11.4 Zed-агент vs pi-агент

Zed имеет свой Agent Panel (у тебя — на `deepseek-reasoner`). Разделение ролей:

- **Zed-агент** — быстрые локальные правки прямо в буфере (держи на дешёвой модели `deepseek-chat`).
- **pi-агент** — оркестрация, многошаговые задачи, токен-экономия, субагенты.

---

## 12. Пайплайн «идея → прод»

```
/plan            → спланировать (flash, low): цель, дизайн, чеклист, риски
реализация       → код (flash, low), точечные edit, дешёвые проверки (typecheck/один тест)
/review          → ревью стадиированных изменений (или delegate субагент-ревьюер)
исправления      → по findings
полный прогон    → тесты + lint + build
/ship            → прод-чеклист: проверки, тесты, docs, commit message
коммит           → git, ревью диффа в Zed
```

Параллельная версия (много независимых модулей):

```bash
pi --model deepseek/deepseek-flash --print "спланируй модуль A" > plan-a.md &
pi --model deepseek/deepseek-flash --print "спланируй модуль B" > plan-b.md &
wait
```

---

## 13. Cheat sheet

**Токены:** стабильный префикс → кэш ×30–50 · flash по умолчанию · `low` thinking · `find/grep` перед
`read(offset/limit)` · `codemode` для параллели и фильтрации · `/compact` при разрастании · следи за
`/session` и кэш-нотисами.

**Оркестрация:** `deepseek/auto` (роутер) → `delegate` (субагенты) → skills/шаблоны (экспертиза) →
extensions (агенты-как-код) → `pi --print`/RPC/SDK (процессы). Начинай с наименее мощного примитива.

**Навигация:** `End` = автоскролл, `PageUp/PageDown` = листание, `Ctrl+F` = поиск, `Ctrl+O` = вывод
инструмента, `Ctrl+T` = thinking, `Ctrl+L` = модель, `Shift+Tab` = мышление.

**Конфиг:** `~/.pi/agent/` (глобально: settings.json, models.json, mcp.json, keybindings.json, auth.json,
extensions/, skills/, prompts/) · `.pi/` в проекте (переопределяет, только после trust).

---

## 14. Переход с GUI на pi: базовая работа в терминале

Если ты пришёл из Cursor / Zed / агентных IDE — главное, что нужно перестроить в голове: **здесь нет кнопок,
есть клавиши.** Всё, что в GUI было кнопкой, дропдауном или панелью, в pi — это хоткей или slash-команда.
Кнопка «Stop» существует — это клавиша. Дропдаун моделей существует — он вызывается клавишей. Ниже —
«переводчик» с языка GUI на язык терминала.

### 14.1 Как устроен экран

| Зона в pi | Что это | Аналог в Cursor/Zed |
|---|---|---|
| Транскрипт (лента сверху) | промпты, ответы, tool calls, вывод | чат-панель |
| Редактор (строка внизу) | сюда набираешь промпт | поле ввода |
| Футер (status bar) | папка, сессия, модель, контекст, стоимость | нижняя статус-строка |

Текст в редакторе **не отправляется**, пока не нажмёшь `Enter`. Пока не нажал — можно менять модель, уровень
мышления, редактировать текст, прикладывать файлы (`@`).

### 14.2 Стоп! Как остановить агента

В GUI была кнопка «Stop». В pi она — клавиша **`Escape`**:

- **`Escape`** — прервать текущий ран: агент остановится, сообщения вернутся в редактор.
- `Ctrl+C` — это **НЕ** «копировать» (см. §14.6). Первое нажатие очищает редактор, второе — выходит из pi.
- `Ctrl+D` — выйти из pi (работает, когда редактор пуст).

Пока агент работает, можно не только стопать, но и рулить:

| Что хочешь | Клавиша (Windows) | Смысл |
|---|---|---|
| Подправить текущую задачу на ходу | набрал текст → `Enter` | steering: встанет после текущего хода |
| Добавить работу после текущей задачи | `Ctrl+Q` | follow-up: выполнится, когда текущая закончится |
| Вернуть отложенные сообщения в редактор | `Alt+Q` | dequeue |
| Остановить совсем | `Escape` | abort |

### 14.3 Смена модели, не удаляя набранный текст

Это ровно тот же паттерн, что `Shift+Tab` для уровня мышления: модель меняется **поверх** набранного
промпта, текст остаётся в редакторе.

- **`Ctrl+L`** — открыть селектор модели (аналог дропдауна в GUI). Выбрал → `Enter`, промпт не тронут.
- **`Ctrl+P`** — переключить на следующую модель в цикле (быстрый перебор без меню).
- **`Alt+P`** — на предыдущую модель в цикле (Windows).
- **`Shift+Tab`** — цикл уровня мышления (effort). Точно так же не трогает текст.
- `/model` и `/thinking` — те же действия через slash-команды.

Порядок моделей в цикле настраивается: `/scoped-models`. Текущая модель видна в футере.

### 14.4 Навигация по переписке (транскрипту)

В GUI ты скроллил чат колесом. В pi (fullscreen-режим) скроллом владеет сам pi, поэтому — клавиши:

| Действие | Клавиша (Windows) |
|---|---|
| Прокрутка на страницу вверх/вниз | `PageUp` / `PageDown` |
| **Вниз + следовать за новым выводом (автоскролл)** | **`End`** |
| В самое начало | `Home` |
| **К предыдущему/следующему сообщению (промпту)** | **`Ctrl+Up` / `Ctrl+Down`** |
| Поиск по транскрипту | `Ctrl+F` (`Enter` след., `Shift+Enter` пред., `Esc` выйти) |
| Развернуть/свернуть вывод инструмента | `Ctrl+O` |
| Свернуть/развернуть thinking | `Ctrl+T` |

**`End` — твой лучший друг:** после любой прокрутки вверх он возвращает вниз и снова «следит» за работой
агента. `Ctrl+Up`/`Ctrl+Down` — то самое «перемещение между пользовательскими запросами».

### 14.5 Редактирование промпта (клавиши текстового редактора)

Редактор pi работает как readline/emacs-подобный — мышки и выделения здесь нет. Основное:

| Клавиша | Действие |
|---|---|
| `Ctrl+A` / `Ctrl+E` | в начало / в конец строки |
| `Ctrl+Left` / `Ctrl+Right` (или `Alt+B` / `Alt+F`) | по слову влево/вправо |
| `Ctrl+W` / `Alt+Backspace` | удалить слово назад |
| `Ctrl+K` / `Ctrl+U` | удалить до конца / до начала строки |
| `Ctrl+Y` | вставить удалённое (yank) |
| `Ctrl+Z` | отмена (на Windows) |
| `Up` / `Down` | пролистать историю промптов (у начала строки) |
| `Shift+Enter` / `Ctrl+J` | новая строка (без отправки) |
| `Tab` | автодополнение пути |
| `@` + текст | поиск и прикрепление файла к промпту |
| `Ctrl+G` | открыть промпт во внешнем редакторе (Zed) для длинного текста |

`Enter` = отправить. Многострочный промпт — `Shift+Enter` (или `Ctrl+G` → Zed).

### 14.6 Копирование и вставка — не перепутай `Ctrl+C`

В терминале `Ctrl+C` — это **не** копирование, а «clear editor / exit». Копирование:

- **`Ctrl+X`** — скопировать последний ответ ассистента (внутри pi).
- Выделение текста терминала — `Ctrl+Shift+C` / `Ctrl+Shift+V` (Windows Terminal) или мышью с `Shift`.
- Вставка изображения/файла в промпт — `Alt+V` (на Windows).

### 14.7 Shell-команды прямо из агента

Не надо выходить из pi и открывать второй терминал:

- `!git status` — выполнить команду, **вывод уйдёт модели** (она его увидит).
- `!!git status` — выполнить команду, **вывод модели не отправляется** (просто для себя).

Это заменяет «переключиться в терминальную вкладку IDE».

### 14.8 Сессии — это чаты: список, переключение, новый, переименование

**Ментальная модель:** «чат» в pi называется **сессией**. Одна сессия = один JSONL-файл в
`~/.pi/agent/sessions/`, сгруппированный по рабочей папке. Постоянного сайдбара со списком чатов на экране
нет — список **открывается командой**. Внутри pi нет и вкладок с чатами: чтобы работать параллельно, держи
несколько сессий и переключайся (`/resume`) либо запусти второй `pi` в отдельной вкладке терминала.

**Список чатов и переключение.** Набери `/resume` — откроется **селектор сессий** (аналог панели
Chat History): начни печатать — список фильтруется, `Enter` — открыть выбранный чат. Снаружи то же самое:
`pi --resume`. Свежий запуск `pi` в папке продолжает последнюю сессию (как «последний чат» в IDE).

| Задача (как в GUI) | Команда / клавиша | Пояснение |
|---|---|---|
| **Новый чат** | `/new` | новая пустая сессия в той же папке |
| Продолжить последний чат | `pi --continue` | при запуске из терминала |
| **Список чатов / история** | `/resume` | интерактивный селектор сессий |
| **Переключиться на чат** | `Enter` в `/resume` | выбрать из списка; текущий чат заменится |
| Переключиться по id/пути | `pi --session <id>` | id виден в `/session` |
| **Переименовать текущий чат** | `/name Мой-чат` | имя показывается в списке |
| **Переименовать в списке** | `Ctrl+R` в `/resume` | прямо в селекторе |
| Удалить чат | `Ctrl+D` в `/resume` | `Ctrl+Backspace` — без подтверждения, если поиск пуст |
| Инфо о текущем чате (id, файл, токены, стоимость) | `/session` | «о текущем чате» |
| Сортировка / показать пути / только именованные | `Ctrl+S` / `Ctrl+P` / `Ctrl+N` | внутри `/resume` |
| Импортировать сессию из JSONL | `/import <path>` | перенос чата из другого места |

**Шорткаты внутри селектора сессий** (`/resume`): печатай → фильтр, `Enter` — открыть, `Esc` — отмена,
`Ctrl+R` — переименовать, `Ctrl+D` — удалить, `Ctrl+S` — сортировка, `Ctrl+P` — показать пути, `Ctrl+N` —
только именованные. Осторожно: `Ctrl+P` и `Ctrl+D` здесь значат **не то же**, что в редакторе
(там — цикл моделей и выход).

**Важно про «чаты»:** сессии привязаны к папке запуска. Запускаешь `pi` в другом каталоге — видишь историю
того каталога. Хранилище по умолчанию `~/.pi/agent/sessions/`; переопределяется `--session-dir` или
`PI_CODING_AGENT_SESSION_DIR`. Эфемерный чат (не сохраняется): `pi --no-session`.

**Ветки внутри одного чата — то, чего нет в Cursor.** В Cursor чат линеен; в pi сессия — это **дерево**.
Можно вернуться к любой реплике и пойти другим путём, не теряя старую ветку:

| Действие | Команда | Когда использовать |
|---|---|---|
| Прыгнуть к более ранней реплике внутри того же файла | `/tree` | альтернативы должны остаться вместе |
| Сделать из ранней реплики отдельный чат | `/fork` | альтернатива — независимая работа |
| Скопировать текущую ветку в новый чат | `/clone` | нужна отдельная копия состояния |

В `/tree` выбери пользовательское сообщение — его текст вернётся в редактор; правь и отправляй, получая новую
ветку. Старые ветки не удаляются.

**Сжатие и экспорт:** `/compact` — сжать контекст, `/export` / `/share` / `/copy` — сохранить или поделиться
чатом (как экспорт треда в IDE).

### 14.9 Два режима интерфейса

- **Fullscreen** (по умолчанию): pi владеет экраном, мышь захвачена, скролл — клавишами. Компактно, но без
  нативного выделения текста и колёсика.
- **Regular** (`/settings` → tui mode, или `--tui-mode regular`): скролл и мышь отданы терминалу (обычный
  scrollback). Привычнее для «GUI-беженца»: выделяй мышью, крути колесо, `Ctrl+Shift+C`/`V`.

Попробуй оба; многие начинают в regular, потом переезжают в fullscreen ради `End`/`Ctrl+O`/поиска.

### 14.10 Как читать диффы: что именно изменил агент

**Главное отличие от Cursor:** Cursor показывает before/after и кнопки **Accept/Reject**. pi пишет изменения
в файлы **сразу** — кнопки принятия нет. Значит, «понять, что изменил агент» = посмотреть **дифф**. Есть три
уровня: прямо в pi, через git, и в Zed.

**1) Дифф прямо в pi (в транскрипте).** Каждый вызов `edit` рисуется цветным диффом:
- **красный `-`** — удалённые строки,
- **зелёный `+`** — добавленные,
- **подсветка (инверсия) внутри строки** — изменённые слова,
- тусклые строки — контекст (не менялись).

`Ctrl+O` — развернуть/свернуть вывод инструмента. Инструмент `write` (новый файл) показывает содержимое
целиком, а не дифф. `edit` требует точный `oldText`: если он не найден, правка не применится — «мимо» агент
не перепишет.

**2) Дифф через git — наземная правда.** Не выходя из pi (в редакторе префикс `!`):
- `!git status` — что изменено/добавлено/удалено (вывод **уйдёт модели**).
- `!!git diff` — полный дифф, **модели не отправляется** (не жжёт токены).
- `!!git diff --stat` — только файлы и число строк.
- `!!git diff -- src/foo.ts` — по одному файлу.
- `!!git diff --staged` — что уже в индексе.

Правило: **`!!` для больших диффов** — смотришь сам, агент не платит токенами.

**3) Ревью в Zed.** В Zed нет «вечного» side-by-side, как в Cursor, но есть всё для ревью:
- **Git panel** (у тебя закреплена слева): `Ctrl+Shift+G` (база VSCode) или палитра `Ctrl+Shift+P` → набери
  `git panel`. Там список изменённых файлов; выбери файл — откроется его дифф.
- **Gutter** (полоса слева от номеров строк) — цветные метки добавленных/изменённых/удалённых строк.
- **`editor: toggle git blame`** — кто и когда менял строку (включая правки агента).
- В палитре набери `git` — там команды твоей версии Zed (`git: stage`, `git: commit`, …).

Для «показать все изменения агента одним списком» надёжнее всего `git diff` в терминале Zed (как открыть
терминал — §11.2).

**4) После ревью — Accept/Reject по-гитовски.**
- Принять по кускам: `git add -p` (интерактивно — **в терминале**, не через `!`).
- Откатить файл: `git restore <file>` (или `git checkout -- <file>`).
- Временно спрятать всё: `git stash`.
- Закоммитить: `git add` + `git commit` (в терминале или в git panel Zed).

**5) Попроси агента объяснить.** Можно спросить: «перечисли, что ты изменил и почему», «покажи дифф по
файлу X», «сделай ревью своих изменений». В проекте есть шаблон `/review` (ревью staged-изменений с
`file:line`, severity и вердиктом ship/fix/block) — сначала `git add -p`, потом `/review`.

**Шпаргалка Cursor → pi/Zed:**

| Cursor | pi / Zed |
|---|---|
| Inline before/after | дифф в транскрипте pi (красный/зелёный), `Ctrl+O` |
| Accept / Reject | `git add -p` / `git restore <file>` |
| Панель изменённых файлов | git panel Zed (`Ctrl+Shift+G`) / `git status` |
| «Кто менял строку» | gutter-метки + `editor: toggle git blame` |
| Откатить правку | `git restore <file>` |
| Стадия + коммит | `git add -p` → `git commit` |

### 14.11 Шпаргалка-переводчик Cursor/Zed → pi

| В GUI (Cursor/Zed) | В pi (терминал) |
|---|---|
| Кнопка Stop | `Escape` |
| Дропдаун модели | `Ctrl+L` (меню) или `Ctrl+P`/`Alt+P` (цикл) |
| Переключатель effort/thinking | `Shift+Tab` |
| Поле ввода чата | редактор внизу, `Enter` = отправить |
| Многострочный ввод | `Shift+Enter` / `Ctrl+J` / `Ctrl+G` (Zed) |
| Сайдбар с чатами / история | `/resume` (список + поиск) |
| Новый чат | `/new` |
| Переключить / переименовать чат | `Enter` в `/resume` / `/name` (`Ctrl+R` в списке) |
| Ветки одного чата | `/tree`, `/fork`, `/clone` |
| Терминальная вкладка | `!команда` / `!!команда` |
| «Accept/Apply изменения» | агент правит файлы сам — смотри diff в Zed (`zed: toggle git blame`) |
| Список всех шорткатов | `/hotkeys` |
| Поиск команды | `/` (меню) |

**Запомни три вещи:** `Escape` = стоп · `End` = вниз и следить · `Ctrl+L` (или `Ctrl+P`) = сменить модель, не
удаляя промпт.

---

## 15. Дорожная карта освоения

1. **Почини среду:** Git for Windows → `!printf 'Bash works\n'`. Это гейт для всего остального.
2. **Проверь DeepSeek:** `pi auth check --provider deepseek --json`, `pi --list-models deepseek`.
3. **Примени глобальные настройки** (раздел 4.2): дефолт `deepseek-flash` + `low`, `defaultTools` с
   `codemode`/`grep`/`find`/`ls`.
4. **Освой цикл за 1 день:** `/model deepseek/auto`, `/plan` → правки → `/review` → `/ship`.
   Привыкни к `End`/`PageUp`/`PageDown` и `Ctrl+O`.
5. **Наблюдай за деньгами:** включи `showCacheMissNotices`, смотри `/session` после каждой задачи.
   Найди, где промахи кэша и где лишние reasoning-токены.
6. **Собери своих специалистов:** добавь skills (`test-writer`, `db-reviewer`, `devops`) и шаблоны под
   свой стек. Прочитай `docs/skills.md`, `docs/prompt-templates.md`.
7. **Включи субагентов:** расширение `subagent` установлено (см. раздел 16) + `delegate` для параллельного ревью/исследования.
8. **Подключи MCP:** GitHub / filesystem / твоя БД. Прочитай `docs/mcp.md`.
9. **Напиши первое расширение:** permission-gate (`tool_call` + hints) или todo-подобный инструмент.
   Примеры: `examples/extensions/` в установке pi (`hello.ts`, `todo.ts`, `jev-router.ts`).
10. **Выйди на процессы:** `pi --print`-пайплайны, потом JSON/RPC/SDK для автоматизации и CI.

Полезные файлы для чтения (в установке pi, `node_modules/@earendil-works/pi-coding-agent/docs/`):
`how-pi-works.md`, `models.md`, `settings.md`, `skills.md`, `extensions.md`, `virtual-models.md`,
`codemode.md`, `mcp.md`, `cli.md`, `keybindings.md`, `windows.md`, `sessions.md`, `compaction.md`,
`packages.md`, `sdk.md`, `rpc.md`.

---

## 16. Практика 2026-10-11: субагенты, стоимость, настройки

Опыт сессии: разбор настроек pi 1.1.0, контроль стоимости, установка субагентов. Всё проверено
на практике, а не по докам.

### 16.1 Контроль стоимости

- **Встроенный учёт:** footer TUI показывает накопленный usage и cost за сессию (то, что в omp-форке
  подаётся как фича — в pi это есть из коробки). `/session` — файл, число сообщений, токены, стоимость
  текущей сессии.
- **`tools/pi-cost/pi-cost.mjs`** — агрегат по всем сессиям `~/.pi/agent/sessions` (JSONL). Считает все
  ветки (реальный расход), cache-hit = `cacheRead / (input + cacheRead)`.
  - Флаги: `--today` — только сегодня; `--last N` — за N дней; `--top N` — топ по стоимости; `--json`.
  - Пример: `node tools/pi-cost/pi-cost.mjs --last 7 --top 5`.
- **Реальная статистика (2026-10):** 317 вызовов / $3.26. v4-pro: $3.05 за 289 вызовов (93% бюджета),
  flash: $0.21 за 28 вызовов. Cache-hit 92% — префикс-кэш DeepSeek работает.
- **Токены субагентов добавляются к счёту сессии** — каждый вызов `subagent` = отдельный процесс pi
  со своим usage.

### 16.2 Модели: переключение и эскалация

- `/model` (Ctrl+L) — выбор; **Ctrl+S на модели сохраняет её дефолтом** (перезаписывает `defaultModel`
  в settings.json).
- `/thinking` (Shift+Tab) — уровень; Ctrl+S сохраняет стартовый уровень.
- `Ctrl+P` — цикл по моделям; `/scoped-models` — состав цикла.
- Правило эскалации (DeepSeek): рутина — `deepseek-flash` + `low`; сложная архитектура / хитрый баг /
  безопасность — `deepseek-v4-pro` + поднять thinking. Статистика подтверждает: рутину держать на flash.
- Смена модели/уровня записывается в сессию; `/resume` восстанавливает их, не трогая дефолты.

### 16.3 settings.json (pi 1.1.0): что стоит и что значит

Актуальный `~/.pi/agent/settings.json`:

```json
{
  "theme": "dark",
  "defaultModel": "deepseek-flash",
  "defaultThinkingLevel": "low",
  "showCacheMissNotices": true,
  "defaultTools": ["+bash", "+grep", "+find", "+ls", "+codemode", "+tool_search"]
}
```

- Записи `+name` в `defaultTools` — **аддитивные**: добавляются к дефолту `read, bash, edit, write`.
  Итоговый набор: read, bash, edit, write, grep, find, ls, codemode, tool_search. Plain-имя без `+` —
  заменяет весь набор.
- `defaultThinkingLevel: "low"` (дефолт pi — `"medium"`) — экономия reasoning-токенов.
- Проектные настройки `.pi/settings.json` переопределяют пользовательские (в этом репо — доп. tools +
  `hideThinkingBlock`).
- Полезные ключи (полный список — `docs/settings.md`):
  - `modelThinkingLevels: {"provider/model": "high"}` — свой стартовый уровень на модель.
  - `enabledModels` — паттерны для стартового выбора и Ctrl+P-цикла.
  - `cacheWarming: "off" | "streaming" | "idle"` — прогрев кэша; при hit% 92% выгода спорная.
  - `hideThinkingBlock`, `compaction.*`, `branchSummary.*`, `quietStartup`, `theme`, `sessionDir`.
- `/settings` — TUI-редактор частых опций; `pi config` — интерактивный TUI по ресурсам (для CI не годится).

### 16.4 Субагенты как в Cursor — расширение `subagent`

В pi.dev **из коробки субагентов нет** (в slash-командах их нет). Но в установке есть официальный
пример-расширение `examples/extensions/subagent/` — полноценная замена Cursor-агентов.

- Регистрирует инструмент `subagent`; модель вызывает его сама из обычного промпта:
  - `Use scout to find all authentication code` — один агент;
  - `Run 2 scouts in parallel: one for models, one for providers` — параллельно;
  - `Use a chain: scout finds X, then planner suggests Y` — цепочка; `{previous}` передаёт вывод
    предыдущего шага.
- Режимы: single `{agent, task}`, parallel `{tasks: [...]}` (**макс. 8 задач, 4 одновременно**),
  chain `{chain: [...]}`.
- Каждый субагент = **отдельный процесс pi с изолированным контекстом**. В выводе — turns/токены/кэш/
  `$cost`/model по каждому агенту. Ctrl+C убивает дочерние процессы.
- **Агент = markdown-файл** с YAML-шапкой:

```markdown
---
name: reviewer
description: Code review specialist
tools: read, grep, find, ls, bash
model: deepseek/deepseek-v4-pro
---
Системный промпт агента...
```

Поля: `name`, `description`, `tools` (строка или массив), `model` (нет — наследует модель/thinking
родительской сессии). Формат модели — `provider/id`.
- **Расположение:** пользовательские `~/.pi/agent/agents/*.md`; проектные `.pi/agents/*.md`
  (включаются через `agentScope: "project" | "both"`, с подтверждением в нетrusted-проектах).
  Агенты перечитываются при каждом вызове — правки без рестарта.
- **Workflow-пресеты** (промпт-шаблоны `~/.pi/agent/prompts/*.md`): `/implement`
  (scout→planner→worker), `/scout-and-plan`, `/implement-and-review`.

**Установка (сделано 2026-10-11; на Windows копированием, не симлинками):**

```bash
SRC="$HOME/.pi/agent/install/releases/1.1.0/node_modules/@earendil-works/pi-coding-agent/examples/extensions/subagent"
mkdir -p ~/.pi/agent/extensions/subagent ~/.pi/agent/agents ~/.pi/agent/prompts
cp "$SRC/index.ts" "$SRC/agents.ts" ~/.pi/agent/extensions/subagent/
cp "$SRC/agents/"*.md ~/.pi/agent/agents/
cp "$SRC/prompts/"*.md ~/.pi/agent/prompts/
```

**Адаптация под DeepSeek:** шаблонные агенты заточены под Claude (`claude-*`) — менять `model:` в
`.md`: scout → `deepseek/deepseek-flash` (дёшево), planner/reviewer/worker → `deepseek/deepseek-v4-pro`.

**Проверка установки:** `pi --print "Reply with exactly: OK"` (чистый выход = расширение
скомпилировалось). Затем в JSONL новой сессии в system-сообщении (`sections.tools`) увидеть
`"name":"subagent"`. В уже запущенной сессии — `/reload`.

### 16.5 Подводные камни

- **`pi --print` наследует env родителя:** запущенный из сессии pi, он получит `PI_MODEL` /
  `PI_PROVIDER` / `PI_REASONING_LEVEL` и проигнорирует `defaultModel` из settings.json. Для проверок
  задавай модель явно: `--model deepseek/deepseek-flash --thinking low`.
- `--model` принимает `provider/id` и суффикс `:<thinking>`.
- Не плодить md-файлы, которые не синхронизированы с кодом: код — источник истины, рассинхрон md/код
  заставляет агента глючить и жечь токены вхолостую (опыт друга с omp-форком: статус-бар со стоимостью,
  пресеты настроек — там; в pi часть этого есть из коробки: footer + `/session`).
- Проверять факты по первоисточнику: доки в установке pi и `examples/` (`subagent`, `handoff.ts`,
  `preset.ts`, `plan-mode`, `permission-gate.ts` и др.).

