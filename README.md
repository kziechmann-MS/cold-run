# Cold Run

Persona-driven browser fieldwork for early UX and product-quality feedback. Give Cold Run a public product URL and a preset or custom persona. Its LLM-guided Playwright agent explores as a first-time user, then returns the interaction trail, screenshots, and evidence-backed feedback.

## What it does

- Provides four starting personas and a custom-persona option.
- Uses Azure OpenAI, GitHub Models, or an OpenAI-compatible API to choose grounded browser actions.
- Records raw DOM evidence, screenshots, and a Playwright video for every run.
- Produces shareable JSON and Markdown reports with prioritized findings.
- Blocks local, private, and reserved network targets by default.

## Run locally

Requires Node.js 20+ and one configured model provider.

```bash
npm install
npx playwright install chromium
export OPENAI_API_KEY="your key"
npm start
```

For GitHub Models, authenticate GitHub CLI and start with `npm run start:github`. The token is passed only to the server process and is never written to disk.

For Azure OpenAI, set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_API_VERSION`. Authentication prefers `AZURE_OPENAI_ACCESS_TOKEN` or an App Service managed identity; use `AZURE_OPENAI_API_KEY` only as a local fallback.

Open <http://localhost:3000>, enter a URL, and choose a persona. JSON/Markdown reports, screenshots, and video are written to `runs/<run-id>/` and are intentionally ignored by Git.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Web server port |
| `AZURE_OPENAI_ENDPOINT` | — | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | — | Azure model deployment |
| `AZURE_OPENAI_API_VERSION` | — | Azure API version |
| `AZURE_OPENAI_ACCESS_TOKEN` | managed identity | Optional Entra access token |
| `AZURE_OPENAI_API_KEY` | — | Local Azure key fallback |
| `GITHUB_TOKEN` | — | GitHub Models credential; populated by `start:github` |
| `COLD_RUN_PROVIDER` | — | Set to `github` by `start:github` to explicitly select GitHub Models |
| `GITHUB_MODELS_MODEL` | `openai/gpt-4.1-mini` | GitHub Models model |
| `OPENAI_API_KEY` | — | OpenAI-compatible API credential |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Chat-completions model |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible API base URL |
| `ALLOW_PRIVATE_TARGETS` | `false` | Set to `true` only for trusted local prototype testing |

Cold Run does not send API credentials to the browser. Page content and run evidence are sent to the configured model provider for action selection and analysis. Use it only for UX/product feedback—never security testing, scraping, destructive actions, transactions, or products containing sensitive or real personal data.

## Validate

```bash
npm run check
```

The tests use Node's built-in test runner and do not make browser or network calls.
