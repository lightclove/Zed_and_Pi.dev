# Zed_and_Pi.dev — лаборатория и харнесс для pi.dev + DeepSeek

**Три вещи в одном репозитории:**

1. **Учебник** — `PI_ZED_DEEPSEEK_MASTERY.md`: пошаговое руководство «от первого запуска до
   собственных расширений и субагентов», написанный для новичка.
2. **Рабочий харнесс** — `.pi/`: расширения, скиллы и промпты, которые реально работают в этом
   проекте (роутер моделей, субагенты, живой баланс DeepSeek, гейты ревью/шипа).
3. **Переносимые заготовки** — `templates/` и `tools/pi-cost/`: то, что копируется в любой новый
   проект под `~/Work`.

Репозиторий публичный: https://github.com/lightclove/Zed_and_Pi.dev

---

## Карта репозитория

```
Zed_and_Pi.dev/
├── PI_ZED_DEEPSEEK_MASTERY.md      ← учебник (главный документ)
├── AGENTS.md                       ← правила для агента в этом проекте
├── README.md                       ← этот файл
│
├── .pi/                            ← проектный уровень конфигурации pi
│   ├── settings.json               ← инструменты + флаги под токен-экономию
│   ├── mcp.json                    ← MCP-серверы: serena, playwright, postgres
│   ├── extensions/                 ← исполняемый код агента (TypeScript)
│   │   ├── deepseek-router.ts      ← виртуальная модель deepseek/auto
│   │   ├── delegate.ts             ← изолированные субагенты одним вызовом
│   │   └── deepseek-balance.ts     ← живой баланс DeepSeek в футере
│   ├── prompts/                    ← переиспользуемые промпты (/команды)
│   │   ├── plan.md                 ← /plan  — планирование с гейтами
│   │   ├── review.md               ← /review — ревью staged-изменений
│   │   └── ship.md                 ← /ship  — прод-чеклист с numbers gate
│   └── skills/                     ← экспертиза, грузится по требованию
│       ├── code-review/            ← глубокое ревью кода (+ чек-лист)
│       └── engineering-principles/ ← Гамильтон + законы Акина (+ первоисточники)
│
├── .zed/                           ← настройки редактора Zed (project-level)
│   └── settings.json               ← LSP: vtsls, inlay hints, tab_size
│
├── .serena/                        ← семантический LSP-слой (MCP Serena)
│   └── project.yml                 ← language servers: ts/md/yaml/json
│
├── templates/                      ← заготовки для переноса в новые проекты
│   ├── mcp/                        ← MCP-заготовка (serena + playwright + postgres)
│   │   ├── mcp.json
│   │   ├── serena.project.yml
│   │   └── README.md               ← инструкция переноса и проверки
│   └── zed-lsp/                    ← Zed LSP-заготовка (TS/JS + Python/Rust/SQL)
│       ├── settings.json
│       └── README.md               ← таблица language servers
│
└── tools/
    └── pi-cost/                    ← отчёт по токенам и деньгам сессий
        ├── pi-cost.mjs             ← агрегатор JSONL-сессий pi
        └── README.md               ← семантика и ограничения
```

---

## Детальное описание файлов

### Корень

#### `PI_ZED_DEEPSEEK_MASTERY.md`

Главный документ репозитория — учебник по работе с pi.dev + DeepSeek. Структура — по пути обучения,
а не по истории написания:

| Часть | Разделы | Что внутри |
|---|---|---|
| I. Первый запуск (день 1) | 1–3 | Установка и проверка (Git Bash, ключ), первый день в терминале (экран, `Escape`, навигация, сессии), справочник команд/хоткеев/CLI/env |
| II. Как устроено (день 2) | 4–7 | Ментальная модель pi, настройки `settings.json`, цены и кэш DeepSeek, десять правил экономии токенов + измерение денег (включая баланс в футере) |
| III. Ежедневная работа (день 3–4) | 8–10 | Рабочий цикл `/plan → код → /review → /ship`, чтение диффов (pi/git/Zed), Zed рядом (LSP, проброс клавиш, вкладки) |
| IV. Продвинутый уровень (неделя 2+) | 11–14 | Оркестрация (5 уровней, роутер, субагенты), API расширений + эталонный код, MCP-серверы, дорожная карта |
| Приложения | 15–17 | Инвентарь проекта, журнал чисел и типичных ошибок, перенос опыта в другие проекты |

Особенности: задания «сделай руками» в конце каждой части.

#### `AGENTS.md`

Инструкции, которые pi читает в каждой сессии этого проекта:

- **Workflow** — исследовать до правки (`find`/`grep`/`ls` → точечные `read`/`edit`), одна
  логическая правка за ход, коммитить рабочие состояния.
- **Инженерные принципы** — краткий свод Гамильтон (H1–H5) + Акин (цифры вместо мнений, YAGNI,
  «better — враг good»), полная версия в скилле `engineering-principles`.
- **Fact-check gate** — каждое утверждение в ответе агента классифицируется как proven/unverified,
  с обязательным футером `Fact-check: <n> proven / <m> unverified / <k> checks`.
- **Модели** — `deepseek-flash` по умолчанию, эскалация на `deepseek-v4-pro` для сложных задач,
  стабильный промпт и инструменты ради кэша.
- **Гигиена** — не коммитить секреты и `auth.json`.

### `.pi/` — проектный харнесс

Файлы этого каталога pi загружает только после подтверждения trust (первый запуск в папке).

#### `.pi/settings.json`

```jsonc
{
  "defaultTools": ["+grep", "+find", "+ls", "+codemode", "+tool_search"],
  "hideThinkingBlock": true,
  "showCacheMissNotices": true
}
```

Проектный уровень поверх глобального `~/.pi/agent/settings.json`: добавляет инструменты для
дешёвого исследования (`+` = аддитивно к дефолтному набору), прячет thinking-блоки и включает
уведомления о промахах кэша.

#### `.pi/mcp.json`

Три MCP-сервера, все с `exposure: deferred` (инструменты не раздувают базовый промпт, подгружаются
через `tool_search`):

- **serena** — семантические инструменты кода через LSP (`uvx --from serena-agent … --context ide
  --project-from-cwd`, `env.PYTHONUTF8=1` для Windows cp1251);
- **playwright** — реальный браузер (`--headless --caps vision`, скриншоты в `.playwright-mcp/`);
- **postgres** — схема и запросы (`enabled: false`, строка подключения из `${DATABASE_URL}`, в репо
  секретов нет).

Проверено 2026-10-15: `serena: connected, 22 tools`, `playwright: connected, 31 tools`,
`postgres: disabled`.

#### `.pi/extensions/deepseek-router.ts`

Виртуальная модель **`deepseek/auto`** — маршрутизатор между `deepseek-flash` и `deepseek-v4-pro`:

- `low` → flash, `high`/`max` → v4-pro;
- **липкая маршрутизация (sticky routing)**: продолжения и повторы (retry) (`reason !== "user"`) остаются на предыдущей модели,
  чтобы не сбрасывать префикс-кэш;
- валидация на границе: модель не в каталоге → явная ошибка, а не тихий дефолт (H1/H3).

Использование: `/model deepseek/auto`, эскалация — `/thinking` или `Shift+Tab`. Разбор кода —
раздел 12.6 учебника.

#### `.pi/extensions/delegate.ts`

Инструмент **`delegate`** — изолированный субагент одним вложенным вызовом DeepSeek:

- параметры `role` / `task` / `model` валидируются на границе;
- `ctx.modelRegistry.streamSimple` → финальный `AssistantMessage`;
- `usage` пробрасывается в результат — сессия корректно считает стоимость субагента;
- ошибки громкие: `isError` + `details` вместо тихого «(empty response)» (Акин 2).

#### `.pi/extensions/deepseek-balance.ts`

Живой баланс аккаунта DeepSeek в футере TUI: `deepseek $46.44 left · this session -$0.149`.

- при старте сессии один раз запрашивает реальный баланс с `https://api.deepseek.com/user/balance`
  (ключ — из провайдера pi, не хардкод);
- между запросами вычитает траты текущей сессии из usage-записей;
- `/balance` — принудительная повторная синхронизация; ошибки показываются честно (`HTTP 401`, `no DeepSeek API key`).

Как установить и что внутри — раздел 7.3 учебника.

#### `.pi/prompts/` — промпт-шаблоны (`/команды`)

| Файл | Команда | Что делает |
|---|---|---|
| `plan.md` | `/plan [goal]` | План до кода: цель, допущения (A9), отвергнутые альтернативы (A12), пошаговый чек-лист с дешёвыми проверками (H1), риски. Код не пишет. |
| `review.md` | `/review [focus]` | Ревью staged-изменений: ошибки ловятся рано или в рантайме (H1/H3), пути отказов (A2), проверка чужих утверждений (A16/A19). Формат: `file:line`, severity, фикс; вердикт ship / fix then ship / block. |
| `ship.md` | `/ship [scope]` | Прод-чеклист: **numbers gate** (тесты, типчек, стоимость — Акин 1/H5), обновление тестов/доков, финальный sanity-проход (Акин 26), commit message. Пушить без подтверждения запрещено. |

#### `.pi/skills/code-review/`

- `SKILL.md` — формат ревью: `[severity] file:line — проблема`, почему важно, конкретный
  фикс; severity: critical/major/minor; вердикт ship / fix then ship / block.
- `references/checklist.md` — чек-лист, который агент читает перед ревью.

#### `.pi/skills/engineering-principles/`

- `SKILL.md` — таблица правил H1–H5 (Гамильтон) и законов Акина (A1–A26) с конкретным
  поведением в этом харнессе + таблица гейтов (где какое правило срабатывает: план/код/ревью/шип).
- `references/hamilton.md` — канонический список принципов Гамильтон.
- `references/akin-laws.md` — канонический список законов Акина с маппингом на харнесс.

Скилл срабатывает при планировании архитектуры, проектировании интерфейсов и гейтировании изменений.

### `.zed/settings.json` — LSP в Zed (project-level)

Zed сам скачивает language servers; этот файл фиксирует выбор и включает полезности:

- `format_on_save: "on"`;
- TypeScript/JavaScript → `vtsls`, `tab_size: 2`;
- `inlay_hints` включены (type hints);
- заготовка с блоками Python (`basedpyright`+`ruff`), Rust (`rust-analyzer`), SQL (`sql-formatter`)
  — в `templates/zed-lsp/`.

Глобальные предпочтения (theme, vim_mode, base_keymap) остаются в `%APPDATA%\Zed\settings.json` —
на проектном уровне они не работают.

### `.serena/` — LSP-бэкенд Serena

- `project.yml` — `project_name: "zed-and-pi-dev"` + список `language_servers`
  (typescript/markdown/yaml/json) + полный справочник языков в комментариях.

Serena сама находит этот файл из корня проекта (`--project-from-cwd`) и качает нужные language
servers. Проверка: `uvx --from serena-agent serena project health-check .`

### `templates/` — переносимые заготовки

Живая копия конфигов лежит в корне (`.pi/mcp.json`, `.zed/settings.json`, `.serena/project.yml`) и
уникальна для этого репо; `templates/` — то, что копируется в новые проекты с поправкой
`project_name` / `language_servers` / `tab_size`.

#### `templates/mcp/`

- `mcp.json` — три сервера (serena, playwright, postgres), все `deferred`, postgres `enabled: false`.
- `serena.project.yml` — заготовка с таблицей языков.
- `README.md` — полная инструкция: предпосылки (uv/uvx, Node), готовность каждого сервера
  («Ready when»), проверки (`pi mcp list`, `health-check`), типичные ошибки (headed Playwright, cp1251,
  секреты через env), таблица exposure-режимов.

#### `templates/zed-lsp/`

- `settings.json` — активный TS/JS-блок + закомментированные Python/Rust/SQL.
- `README.md` — где живут настройки (global vs project), как выбрать language server (`"..."`/`"!name"`),
  таблица языков, заметки (SQL-LSP не существует, inlay hints выключены по умолчанию, что не работает
  на проектном уровне).

### `tools/pi-cost/` — отчёт по деньгам

- `pi-cost.mjs` — агрегатор JSONL-сессий pi: суммирует **все** записи (включая заброшенные ветки —
  это реальный расход), считает `hit% = cacheRead / (input + cacheRead)`, reasoning, стоимость.
  Флаги: `--today`, `--last N`, `--top N`, `--json`.
- `README.md` — семантика, ограничения (схема привязана к формату pi 1.x; при обновлении pi сверять
  с `/session`).

Запуск: `node tools/pi-cost/pi-cost.mjs --last 7 --top 5`.

---

## Быстрый старт

```bash
git clone https://github.com/lightclove/Zed_and_Pi.dev.git
cd Zed_and_Pi.dev
pi            # подтвердить trust → /reload
```

Дальше — открыть `PI_ZED_DEEPSEEK_MASTERY.md` и идти по частям I–IV. Харнесс загрузится сам после
trust; для переноса в свой проект — `templates/` и раздел 17 учебника.

Требования: Git for Windows, pi (v1.x), ключ DeepSeek в `DEEPSEEK_API_KEY`, Node.js (для MCP и
`pi-cost`), `uvx` (для Serena), Zed — опционально.
