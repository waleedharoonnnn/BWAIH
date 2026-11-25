# AgentTest

A harness-agnostic testing, validation and scoring dashboard for AI agents.

**Live:** https://bwaih-three.vercel.app · **Demo script:** [DEMO.md](DEMO.md)

## Features

- **Test Suite Builder:** each test case has a trigger prompt, an expected tool sequence, a golden response and assertions.
- **Execution Runner:** calls any agent URL and streams progress live over Server-Sent Events.
- **Deterministic assertions:**
  - tool called
  - tool order (in-order subsequence)
  - step limit
  - parameter type
  - output contains / does not contain
- **LLM-as-a-Judge:** a Groq model scores the agent's answer against the golden response (0–100). It flags hallucinations and checks claims against the agent's own tool results.
- **Reliability score:** run each test 1–5 times. You get a pass rate per test, flaky tests are flagged ("passes 1/2"), and token and step variance is shown.
- **Regression comparison:** compare any two runs to see which tests regressed or were fixed, and how pass rate, semantic score, tokens and steps changed. Each run records the agent URL it tested, so you can see what changed.
- **Report card:** pass/fail per test, an expected-vs-actual tool diff, the full execution trace, token usage and semantic scores.

## Connecting an agent

The runner sends `POST {"prompt": "...", "input": "...", "message": "..."}` with an optional `Authorization: Bearer <key>` header. It accepts any of these replies:

| Format | Response text | Trace |
|---|---|---|
| AgentTest | `response` | `trace[]` (`tool`, `params`, `result`) |
| OpenAI chat completions | `choices[0].message.content` | `choices[0].message.tool_calls` |
| Anthropic messages | `content[type=text]` | `content[type=tool_use]` |
| LangChain | `output` | `intermediate_steps` |
| Plain text / other JSON | body, or `output` / `answer` / `text` / `result` | (none) |

If the agent returns no trace, the output assertions and semantic scoring still run.

### Built-in live agent: `/api/agent`

The app includes a real Groq-powered agent (`openai/gpt-oss-120b`, which you can override with `AGENT_MODEL`). Its tools call live public APIs: Wikipedia, Open-Meteo weather, Frankfurter currency rates, a calculator and a clock. Set `AGENT_API_KEY` to require a bearer token.

`/api/agent?version=v2` is the same agent with shorter tool descriptions, a shorter system prompt and `amount` retyped as a string. Use it to show how a small config edit causes regressions that **Compare Runs** catches.

**Rate limits:** on Groq's free tier, each model allows 8,000 tokens per minute. Long suites with several runs per test are throttled; the agent waits and retries. A run stops starting new attempts after about 4.5 minutes, so it always finishes within Vercel's 5-minute limit.

## Setup

```bash
npm install
npx drizzle-kit push   # create tables
npm run seed           # optional: add the "Live Research Agent" demo suite
npm run dev
```

`.env.local`:

```
DATABASE_URL=postgresql://...        # Neon Postgres
GROQ_API_KEY=gsk_...                 # judge + built-in agent
NEXT_PUBLIC_APP_URL=http://localhost:3000
# optional
AGENT_API_KEY=...                    # protect /api/agent
AGENT_MODEL=openai/gpt-oss-120b
BASIC_AUTH_PASSWORD=...              # password-protect the whole app (user: admin)
```

## Stack

Next.js 16 (App Router) · Neon Postgres + Drizzle ORM · Groq · Tailwind CSS + shadcn · Recharts · Vercel
