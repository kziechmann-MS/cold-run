# Cold Run

Persona-driven browser fieldwork for early UX and product-quality feedback. Give Cold Run a public product URL and a preset or custom persona. Its LLM-guided Playwright agent explores as a first-time user, then returns the interaction trail, screenshots, and evidence-backed feedback.

## What it does

- Provides four starting personas and a custom-persona option.
- Uses an OpenAI-compatible chat-completions API to choose grounded browser actions.
- Records the page, screenshot, rationale, observation, and result at every step.
- Produces prioritized findings and recommendations from the selected persona's perspective.
- Blocks local, private, and reserved network targets by default.

## Run locally

Requires Node.js 20+ and an OpenAI-compatible API key.

```bash
npm install
npx playwright install chromium
export OPENAI_API_KEY="your key"
npm start
```

Open <http://localhost:3000>, enter a URL, and choose a persona. Reports and screenshots are written to `runs/<run-id>/` and are intentionally ignored by Git.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Web server port |
| `OPENAI_API_KEY` | — | API credential (required to run an agent) |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Chat-completions model |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible API base URL |
| `ALLOW_PRIVATE_TARGETS` | `false` | Set to `true` only for trusted local prototype testing |

Cold Run does not send API credentials to the browser. Page content and run evidence are sent to the configured model provider for action selection and analysis. Do not test products containing sensitive or real personal data.

## Validate

```bash
npm run check
```

The tests use Node's built-in test runner and do not make browser or network calls.
