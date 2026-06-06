# agenttest

**Universal AI Agent Testing Framework** — test and validate autonomous AI agents the way engineers test any other software.

---

## The Story

Shipping an AI agent without repeatable verification is like driving at night with the headlights off. You tweak a prompt, adjust a tool description, or shift an underlying schema — and something quietly breaks. No alarm, no stack trace, just wrong answers downstream. We built **agenttest** to add the instruments that were missing: structured test suites, full execution traces, deterministic assertions, and an LLM-as-a-judge scoring layer. Now teams can evolve their agents with confidence instead of crossed fingers.

---

## Problem Statement

AI agents are no longer simple chatbots. They orchestrate dynamic tool calls, query enterprise Knowledge Bases through RAG pipelines, and interact with external services through interfaces like Model Context Protocol (MCP) servers. This complexity introduces a fragile surface area that today's developer tooling does not adequately address.

**The core gaps:**

- A single wording change in an MCP tool description can silently cause an LLM — Claude, GPT, or any open-source model — to misfire, hallucinate, or skip a critical step.
- Evaluating agent behavior today means running test queries by hand and deciding whether the result "feels" right. This is slow, error-prone, and impossible to reproduce at scale.
- Inspecting the final text output is not enough. You need to verify the execution path: did the agent call Tool A, process the result, and correctly proceed to Tool B?

There is no repeatable, harness-agnostic way to test AI agents like deterministic software. **agenttest** changes that.

---

## What agenttest Is

**agenttest** is a full-stack dashboard for constructing, running, and scoring AI agent test suites. It is built as a Next.js application with:

| Layer                  | What it does                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **Test Suite Builder** | Define prompts, expected tool call sequences, and golden responses                         |
| **Execution Runner**   | Dispatch test payloads to any agent API and capture the full multi-step trace              |
| **Assertion Engine**   | Apply deterministic code checks against tool calls, parameter types, and step counts       |
| **Groq Judge**         | Run a lightweight LLM-as-a-judge for semantic scoring of RAG relevance and answer intent   |
| **Report Card**        | Display pass/fail states, failure step, tool diffs, token usage, and semantic drift scores |

**Key constraints it respects:**

- **Harness-agnostic** — works with agents built on any foundation model or runtime (Anthropic Claude, OpenAI, custom internal wrappers, etc.)
- **Accessible** — designed for developers, QA engineers, and product managers alike; no complex testing code required
- **Trace-first** — evaluates execution paths, not just final outputs

---

## What It Solves

| Challenge                                     | How agenttest addresses it                                     |
| --------------------------------------------- | -------------------------------------------------------------- |
| Silent breakage from prompt or schema changes | Locked test suites catch regressions on every run              |
| No repeatable verification workflow           | Deterministic assertions define pass/fail criteria in code     |
| Final-output evaluation is insufficient       | Execution traces validate the full tool call sequence          |
| Semantic quality is hard to measure           | Groq-powered LLM judge scores relevance and intent drift       |
| Setup friction for non-engineers              | Dashboard UI for suite creation, run management, and reporting |

---

## Live Demo

> https://bwaih.vercel.app/dashboard

---

## Project Structure

```
universal-ai-agent-framework/
├── app/                    # Next.js pages and API routes
├── lib/
│   ├── agent-runner.ts     # Execution runner — dispatches payloads, captures traces
│   ├── assertions.ts       # Deterministic assertion engine
│   ├── groq-judge.ts       # LLM-as-a-judge semantic scoring
│   └── seed.ts             # Sample suites and test cases
├── api/
│   └── mock-agent/         # Built-in mock agent endpoint for local demos
├── PROJECT.md              # Design notes and database schema
└── .env.local              # Environment variables (not committed)
```

**Stack:** Next.js · TypeScript · Neon (Postgres) · Drizzle ORM · Groq API · Server-Sent Events (SSE live run stream)

---

## Setup (Local)

### 1. Prerequisites

- Node.js 18+ and npm or pnpm
- A Postgres-compatible database ([Neon](https://neon.tech) recommended)
- A Groq API key for semantic scoring (optional — the mock agent works without it)

### 2. Install dependencies

```bash
cd universal-ai-agent-framework
npm install
```

### 3. Environment variables

Create `.env.local` inside `universal-ai-agent-framework/`:

```env
DATABASE_URL=postgresql://...       # Neon connection string
GROQ_API_KEY=gsk_...                # Optional: Groq judge key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Seed demo data (optional)

```bash
npx ts-node lib/seed.ts
```

### 5. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

### 6. Quick demo (no external agent required)

Create a new test suite and set the agent URL to `/api/mock-agent`. The runner will use the built-in mock agent so you can explore the full test-run and report flow immediately.

---

## Evaluation Architecture

**agenttest** evaluates agents along two complementary axes:

**Deterministic assertions** — strict code checks that validate runtime parameters:

- Did the agent trigger the correct tool?
- Did it pass the expected parameter types?
- Was the execution path completed within the expected step budget?

**Semantic evaluation (LLM-as-a-judge)** — lightweight scoring of fluid, language-level quality:

- Is the retrieved RAG context relevant to the prompt?
- Does the final answer match the intent of the golden dataset without hallucinating data?

Both layers surface in the **Report Card**, giving teams a complete view of correctness at every level of the agent stack.

---

## Contributing

1. Add more test suites and cases through the dashboard UI.
2. Wire a real external agent by supplying its API URL and auth key when creating a suite.
3. Improve the seed data or open a PR to add an `npm run seed` convenience script.
