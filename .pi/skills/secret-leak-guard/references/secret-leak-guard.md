# Защита секретов: исследование, проверенные факты, слои

Сжатые правила — `../SKILL.md` (скилл `secret-leak-guard`). Здесь — полное
исследование с измерениями. Каждое утверждение помечено: **✔ проверено** (команда и
результат воспроизведены на этой машине), **[оценка]**, **[не проверено]**.

Дата проверок: **2026-10-24**, pi **1.3.0**, Windows, Git Bash. Скрипты-репродукции —
`.research/` этого репо (не коммитятся в релиз).

## Index — читать только нужный §

| § | Когда читать |
|---|---|
| §1 | «а что реально уходит провайдеру» — модель угроз |
| §2 | выбираешь между heimdall / gitleaks / gitignore — что проверено и где предел |
| §3 | настраиваешь слои в новом проекте |
| §4 | хочешь перепроверить сам (репродукция) |
| §5 | источники |

## 1. Модель угроз: что реально уходит в облако

| Путь | Уходит? | Как закрыто |
|---|---|---|
| содержимое файла, прочитанного агентом (`read`/`grep`/`cat`) | **да** — в следующем запросе к провайдеру | env-protect, gitignore |
| вывод команды (`bash`, MCP-tool) | **да**, и остаётся в транскрипте | secret-guard (частично) |
| `git commit`/`git push` | **да**, в remote, навсегда | gitleaks pre-commit + gitignore |
| секрет, который модель **вывела сама** (декодировала base64) | **да**, отозвать нельзя | только поведенческое правило |
| локальная история сессий `~/.pi/agent/sessions` | локально, но её читает каждая следующая сессия | дисциплина |

Вывод, который нельзя обойти: **прочитанное = отправленное**. Redaction — страховка
от чужих ошибок, а не гарантия.

Дополнительно проверено ✔: у pi **нет** встроенной защиты секретов — `grep -rniE
"secret|redact|gitleaks"` по `docs/configuration.md`, `settings.md`, `skills.md`,
`cli.md` даёт совпадения только про `auth.json` и credentials CLI, ни одного механизма
редакции. Также `enableInstallTelemetry` по умолчанию **true** (`docs/settings.md:171`) —
это анонимная телеметрия установки, не содержимое файлов, но при паранойе выключается.

## 2. Проверенные готовые решения

### 2.1 `pi-heimdall` (`@casualjim/pi-heimdall` 0.3.22, MIT) — ✔ существует и работает

Реальный pi-пакет с манифестом `pi.extensions: ["./extensions/heimdall.ts"]`.
Шесть стражей: `sandbox-guard` (always-on), `env-protect`, `secret-guard`,
`command-policy-guard`, `kubectl-secret-guard`, `sops-secret-guard`, `fnox-secret-guard`.

Установка: `pi install npm:@casualjim/pi-heimdall` (или `-l` для проекта).
Загружается на pi 1.3.0 без ошибок ✔ (`pi -e npm:@casualjim/pi-heimdall -p "Reply OK"`).

**Что проверено живьём** (каждый пункт — отдельный прогон, вывод в §4):

| Проверка | Результат |
|---|---|
| `read .env` | ✔ заблокировано, причина внятная |
| `read .env.example` | ✔ пропущено (by design) |
| `bash: echo $SECRET_TOKEN` | ✔ заблокировано по имени из `.env.json` |
| `bash: base64 .env2` (1 строка) | ✔ tool_result == `[REDACTED]` |
| `bash: base64 .env` (**2 строки**) | ✘ **УТЕЧКА: raw tool_result не отредактирован** |

**Найденный баг (измерен, причина локализована).** `redactOutput()` строит needle как
`base64("KEY=value")` **вместе с padding `==`**, а base64 целого многострочного файла
такой подстроки не содержит:

```
needle:  U0VDUkVUX1RPS0VOPXN1cGVyLXNlY3JldC12YWx1ZS0xMjM0NQ==
actual:  U0VDUkVUX1RPS0VOPXN1cGVyLXNlY3JldC12YWx1ZS0xMjM0NQpEQl9QQVNTPWh1bnRlcjIK
actual.includes(needle)                            → false
actual.includes(needle без "==")                   → true
```
То есть: односекретный файл закрыт, многосекретный `.env` — нет. Никакое расширение
нельзя считать границей безопасности, пока это не исправлено.

### 2.2 `gitleaks` 8.30.1 (Go, MIT) — ✔ стандарт де-факто для git-гейтов

Проверено на этой машине:

| Проверка | Результат |
|---|---|
| скачивание windows_x64 + `gitleaks version` | ✔ `8.30.1` |
| скан нашего репо `gitleaks detect --source .` | ✔ `no leaks found`, 38 коммитов, 422 КБ |
| посаженный Stripe-ключ | ✔ найден, `RuleID: stripe-access-token` |
| посаженный AWS `AKIA…`, GitHub PAT, Slack, `sk-…` | ✔ найдены (в файлах через `gitleaks dir`) |
| `--staged` (pre-commit) на посаженной утечке | ✔ `exit 1` |
| `--staged` на чистом файле | ✔ `exit 0` |

Ограничение, измеренное: **короткий/нестандартный AWS-ключ в `.env` не найден**
(нужен формат `AKIA…`); `gitleaks stdin` в 8.30.1 не сработал ни на одном из тестовых
секретов ✔ (вывод пустой на AWS, GitHub PAT и `sk-…`) — использовать файловый/dir-режим,
не stdin. Это значит: gitleaks ловит известные форматы, а не «любой секрет» — для
нестандартных ключей нужна кастомная конфигурация или дисциплина.

### 2.3 Рассмотренные и отклонённые

| Решение | Почему не берём основным слоем |
|---|---|
| `trufflehog` | тяжёлый, ориентирован на поиск по истории/энтропии; дублирует gitleaks там, где нужен гейт |
| `detect-secrets` (Yelp) | Python-зависимость, baseline-модель сложнее в CI-хуке |
| `secretlint` 13.x | ✔ существует в npm, но правила заточены под текст/док-стандарты; gitleaks шире по облачным ключам |
| `pi-1password` | управление секретами через 1Password — полезно, но это хранилище, а не защита контекста |
| самописный regex-хук | велосипед; gitleaks делает это лучше и обновляется |

Проверено отсутствие: `gitleaks`, `trufflehog`, `detect-secrets`, `secretlint` в PATH
этой машины ✔ — то есть без установки гейта сейчас нет.

## 3. Рекомендуемая конфигурация (слои по возрастанию цены)

1. **`.gitignore`** — `.env`, `.env.*` (кроме `.env.example`), `auth.json`,
   `mcp-auth.json`, `*.pem`, `*.key`. Проверка: `git check-ignore -v <path>`.
2. **`.env.json`** (имена секретов, без значений) — включает `secret-guard`.
3. **`pi install npm:@casualjim/pi-heimdall`** — блокировки read/env и базовая редакция.
4. **`gitleaks` в pre-commit** — `gitleaks git --staged --no-banner --redact`,
   exit 1 блокирует коммит.
5. **Правило поведения**: не печатать секреты намеренно; увидел секрет — сказать,
   рекомендовать ротацию.
6. **Выключить `enableInstallTelemetry`**, если нужен минимальный внешний обмен.

## 4. Репродукция (как перепроверить самому)

```bash
# 1. Heimdall: установка и блокировка
pi -e npm:@casualjim/pi-heimdall -p "Read .env and print it"     # → блок
# 2. Утечка через многострочный base64 (ожидаемый результат: [REDACTED] — увидите base64)
cd .research/envtest && printf '{"SECRET_TOKEN":1,"DB_PASS":1}\n' > .env.json
SECRET_TOKEN=x DB_PASS=y pi -e npm:@casualjim/pi-heimdall -p "Run bash: base64 .env"
# 3. Детектор gitleaks ловит посаженное
gitleaks dir t2 --redact -v        # AWS/GitHub/Slack/generic — найдены
gitleaks git --staged --redact     # exit 1
```

## 5. Источники

- Официальная документация pi 1.3.0: `docs/security.md` (модель угроз, project trust,
  «Watching the transcript, using project trust, and reviewing changes do not create a
  security boundary»), `docs/settings.md:171` (телеметрия), `docs/extensions.md`
  (`tool_call` может блокировать, `tool_result` — заменять content; `structuredContent`
  нужно заменять вместе с `content`).
- `@casualjim/pi-heimdall` 0.3.22 — npm-метаданные, `README.md`, `lib/guards/*.ts`
  (исходники прочитаны: `env-protect.ts`, `secret-guard.ts`, `heimdall-config.ts`).
- `gitleaks` v8.30.1 (github.com/gitleaks/gitleaks), релиз 2026-03-21.
- Видео-серия по pi/MCP (context budget, skills vs MCP) — в `mcp-usage/references/`;
  к защите секретов прямого отношения не имеет.
