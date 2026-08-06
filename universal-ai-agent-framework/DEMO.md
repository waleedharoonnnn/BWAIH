# Demo / Walkthrough Script

A copy-paste-ready script for presenting the **Universal AI Agent Testing Framework**. Every value below was tested against the actual mock agent's deterministic logic, so following it produces exactly the pass/fail/score outcomes described.

---

## 1. The 30-Second Pitch

> "AI agents rely on tools, RAG pipelines, and MCP servers. Today, testing them is manual — you tweak a prompt and eyeball whether the output 'feels right.' This is **Postman + Jest, but for AI agents**: you define what an agent *should* do, run it against any agent API, and get a report card with both deterministic checks (did it call the right tool, in the right order, within N steps?) and semantic scoring (does the answer actually match the intent, or did it hallucinate?)."

**Harness-agnostic** — the "agent" is just a URL. Point it at Claude, GPT, Gemini, or a custom runtime; the framework doesn't care.

---

## 2. Architecture in One Breath

- **Next.js 16** (App Router, Turbopack) — frontend + API routes
- **Neon Postgres + Drizzle ORM** — stores suites, test cases, runs, results
- **Groq (Llama 3.3 70B)** — LLM-as-judge for semantic scoring
- **Server-Sent Events** — live streaming of test execution
- **Mock agent** (`/api/mock-agent`) — a built-in fake agent so you can demo without wiring up a real one

Four tables: `test_suites → test_cases`, `test_suites → test_runs → test_results`.

---

## 3. One-Time Setup (before the demo)

```bash
cd universal-ai-agent-framework
npm install
npx drizzle-kit push        # creates tables from lib/db/schema.ts
npm run dev -- -p 3001      # or whatever port is free
```

`.env.local` needs:
```
DATABASE_URL=postgresql://<your-neon-connection-string>
GROQ_API_KEY=gsk_<your-groq-key>
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**Gotcha:** Turbopack compiles each route on first hit — the very first click into a new page can take 10–30s. Click through every page once *before* your audience is watching, so the compiled routes are warm.

---

## 4. Live Demo Script

The narrative: build one suite that **passes cleanly**, then two more that **deliberately demonstrate the framework catching failures** — one via deterministic assertions, one via the semantic judge. This maps directly to the problem statement's "dual evaluation paradigm."

### Step 1 — Dashboard tour (30s)

Go to `/dashboard`. Point out: suite/case/run counts, pass-rate trend chart, recent runs table. Empty at first — that's fine, it fills in as you go.

### Step 2 — Create the "happy path" suite

Go to `/suites/new`. Fill in:

| Field | Value |
|---|---|
| Suite Name | `Support Agent — Happy Path` |
| Description | `Baseline checks against a healthy agent response` |
| Agent API URL | *(leave pre-filled)* `http://localhost:3001/api/mock-agent` |
| Agent Auth Key | *(leave blank — mock agent needs none)* |
| Judge Model | `Llama 3.3 70B Versatile` (default, most accurate) |

Click **Create Suite**.

### Step 3 — Add test cases to it

**Test case A — exact semantic match**

| Field | Value |
|---|---|
| Name | `Knowledge base search` |
| Trigger Prompt | `Search the knowledge base for our refund policy` |
| Expected Tool Sequence | `search_knowledge_base`, `generate_response` |
| Golden Response | `I searched the knowledge base and retrieved 3 relevant documents. Based on the retrieved context, the requested information is available and has been compiled. The top result has a relevance score of 0.92.` |
| Assertions | `tool_called` → `search_knowledge_base`; `step_limit` → `4` |

This golden response is *word-for-word* what the mock agent returns for any "search" prompt — expect a semantic score around **95–100** and a pass.

**Test case B — summary path with assertions**

| Field | Value |
|---|---|
| Name | `Document summarization` |
| Trigger Prompt | `Summarize this document into a brief overview` |
| Expected Tool Sequence | `retrieve_documents`, `summarize_text`, `generate_response` |
| Golden Response | `Here is a concise summary: the document covers three key areas — system configuration, data validation, and output formatting — and all operations completed successfully with no errors.` |
| Assertions | `tool_order` → `retrieve_documents, summarize_text, generate_response`; `step_limit` → `4` |

### Step 4 — Run it, watch it live

Go to the suite page → **Run Suite**. This opens the SSE live view — narrate what's streaming in real time: `test_started` → `trace_captured` (tool-by-tool trace with params) → `semantic_scored` (Groq's score + reasoning) → `test_completed`. Both cases should pass with high semantic scores.

### Step 5 — Show the report card

Click into the completed run (`/runs/[id]`). Point out per-test: pass/fail badge, tool trace timeline, token usage, semantic score with reasoning text from the judge (this is the LLM explaining *why* it scored what it did — good talking point for judges).

### Step 6 — Demonstrate a deterministic-assertion failure

Create a second suite:

| Field | Value |
|---|---|
| Suite Name | `Support Agent — Wrong Tool Path` |
| Agent API URL | `http://localhost:3001/api/mock-agent?mode=fail` |

Reuse the same test case values as Test case A above. The `?mode=fail` query param makes the mock agent call the *wrong* tools (`classify_intent`, `call_external_api`, `validate_input`) and return an error-ish response. Run it — the `tool_called: search_knowledge_base` assertion fails, and the semantic score tanks. This is the **deterministic side** of the evaluation engine catching a structural regression (wrong tool path) that a human skimming the final text might miss.

### Step 7 — Demonstrate hallucination detection

Create a third suite:

| Field | Value |
|---|---|
| Suite Name | `Support Agent — Hallucination Check` |
| Agent API URL | `http://localhost:3001/api/mock-agent?mode=hallucinate` |

Reuse Test case A's golden response. `?mode=hallucinate` makes the mock agent return a response stuffed with fabricated specifics ("42.7 million users... 312% growth... report XR-9921..."). The Groq judge flags `hallucinated: true` and scores it near 0, even though the response *sounds* confident and detailed. This is the **semantic side** catching what deterministic checks structurally cannot.

### Step 8 — Compare two runs head-to-head

Go to `/compare`. Pick the Happy Path run as Agent A and the Wrong Tool Path (or Hallucination) run as Agent B. Walk through the benchmark breakdown: accuracy, semantic quality, token efficiency, step speed, and the weighted overall score (35% accuracy + 35% semantic + 15% efficiency + 15% speed). This is the "benchmark two agent versions/prompts against each other" use case — useful when someone asks "how do I know if my prompt change made things better or worse?"

### Step 9 — Bonus: AI Code Checker

Go to `/code-checker`. Paste a small snippet with an obvious issue, e.g.:

```js
function getUser(id) {
  const query = "SELECT * FROM users WHERE id = " + id;
  return db.query(query);
}
```

Context: `Express route handler that fetches a user by ID`. Click **Analyze Code Quality**. Groq should flag the SQL injection risk as a critical issue, plus a quality score/grade. This is a secondary tool riding on the same Groq integration — good to mention if time allows, but the core pitch is the agent-testing framework above.

---

## 5. Anticipated Questions

**"How is this different from just writing unit tests?"**
Unit tests check deterministic code paths. Agent outputs are non-deterministic — the same prompt can produce different phrasing every time. You need semantic scoring (LLM-as-judge) alongside structural checks (tool call assertions), because "does this look right" isn't a `===` comparison.

**"What if my agent isn't a simple JSON-in/JSON-out API?"**
The mock agent is the reference contract (`{ prompt }` in → `{ response, trace, token_usage, step_count }` out — see `app/api/mock-agent/route.ts`). Any real agent just needs a thin adapter matching that shape. This is what makes it harness-agnostic.

**"Can I plug in a different judge model?"**
Yes — the suite's Judge Model field picks from Groq's available models (`lib/groq-models.ts`): Llama 3.3 70B (most accurate), Llama 3.1 8B Instant (fastest), Mixtral, Gemma 2, etc. Trade-off is speed vs. judgment quality.

**"What happens on delete — do I lose everything?"**
Deleting a suite cascades through test cases, runs, and results (enforced at the DB level via `onDelete: cascade` in `lib/db/schema.ts`), so cleanup is a single action.

---

## 6. If Something Breaks Mid-Demo

- **Page hangs on first click** → Turbopack cold-compiling that route. Wait it out once; it's instant afterward. Pre-warm before the audience arrives (see §3).
- **Run stays stuck on "running"** → The run record is created by `POST /api/runs`, but execution only actually happens when the SSE stream (`/api/stream/[runId]`) is opened — this is what the "Run Suite" button does client-side. If you're testing via `curl`/API directly instead of the UI, you must hit the stream endpoint yourself.
- **Delete suite fails** → Already fixed (cascade constraints added to `test_runs.suite_id` and `test_results.test_case_id`). If you see this again, it means the DB is out of sync with `schema.ts` — re-run `npx drizzle-kit push`.
