# GitHub Actions CI harness (universal)

Канонический конвейер CI для любого проекта: один проверенный пайплайн, который проекты
не форкают, а только **декларируют входы**. Правила и обоснования — скилл `ci-cd`
(`.pi/skills/ci-cd/`); полная справка — его `references/github-actions.md`.

## Состав

| Файл | Роль |
|---|---|
| `workflows/reusable-ci.yml` | канонический конвейер (`workflow_call`): secret scan → lint → typecheck → test → build. Не редактировать в проектах |
| `workflows/ci.yml` | точка входа проекта: триггеры + входы (контракт). Единственный файл, который проект правит |
| `actions/setup/action.yml` | composite: тулчейн + кэш зависимостей + install для node / python(uv) / rust / go |
| `scaffold-ci.mjs` | генератор: определяет язык, подбирает команды, раскладывает файлы по `.github/` |

## Установка в проект

```bash
# автоопределение языка по манифестам (package.json / pyproject.toml / Cargo.toml / go.mod)
node templates/github-actions/scaffold-ci.mjs <путь-к-проекту>

# или явно + перезапись существующего ci.yml
node templates/github-actions/scaffold-ci.mjs <путь-к-проекту> --lang python --force
```

Результат:

```
<проект>/.github/
├── workflows/
│   ├── ci.yml              # контракт: язык, версии, команды — правится вручную
│   └── reusable-ci.yml     # канонический конвейер — не трогать
└── actions/setup/action.yml
```

## Контракт (входы `ci.yml`)

| Вход | Пустой = | Дефолт scaffolder'а |
|---|---|---|
| `language` | обязателен: `node` \| `python` \| `rust` \| `go` | — |
| `*-command` (`install`/`lint`/`typecheck`/`test`/`build`) | джоба пропускается | реальные команды проекта, где возможно |
| версии (`node-version`, `python-version`, `go-version`, `rust-toolchain`) | — | 20 / 3.12 / stable / stable |
| `node-cache` | — | `npm` (pnpm/yarn по локфайлу) |

Правило: **пустая команда — пропущенная джоба, не ошибка**. Проект без тестов получает
CI без test-джобы (scaffolder предупредит); тесты — настоящий гейт, их стоит завести.

## Правила (кратко; полные — скилл `ci-cd`)

1. **CI — самый дешёвый детектор ошибок** (H1): lint/typecheck/test на каждом push и PR,
   до того как сбой увидит человек.
2. **Дёшево раньше дорогого**: secret scan → lint → typecheck → test → build; дорогие
   джобы гейтятся дешёвыми.
3. **CI не нужны секреты**: пайплайн сборки/тестов не использует ни одного credentials.
   Секреты появляются только на деплое — через OIDC, не долгоживущие токены.
4. **Не форкать конвейер**: меняется `ci.yml` (контракт), не `reusable-ci.yml`.
5. **Пиновать экшены**: мажорный тег (`@v7`), для security-sensitive репозиториев — SHA.
6. **Красную джобу чинить, а не выключать**: никаких `|| true` и `continue-on-error`.

## Первый запуск — проверить

- [ ] lint + typecheck + test зелёные **локально** (CI не место первого запуска — H1).
- [ ] Первый прогон просмотрен целиком; кэш зависимостей восстановился.
- [ ] `secret scan (gitleaks)` отработал; ложное срабатывание → `.gitleaksignore`, не отключение.
- [ ] `permissions: contents: read` — без секретов в настройках репозитория.

## Версии экшенов (сверены с живой документацией, окт. 2025)

`actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7`,
`actions/setup-go@v7` (кэш включён по умолчанию), `astral-sh/setup-uv@v10`,
`gitleaks/gitleaks-action@v3`, `Swatinem/rust-cache@v2`, `dtolnay/rust-toolchain@stable`.
