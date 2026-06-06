# Universal AI Agent Testing Framework
### Build With AI 2026 — Astera Software Problem Statement
**Team:** 4 Members | **Stack:** Next.js + Neon + Groq | **Deadline:** 05:00 PM

---

## 01 · Problem Summary

AI agents rely on tools, RAG pipelines, and MCP servers. Testing them today is manual and fragile — a small wording change in a tool description can silently cause an LLM to hallucinate or skip a step. We need an engineering-grade, repeatable, harness-agnostic framework to test AI agents like deterministic software.

---

## 02 · Solution Brief

A **Universal Agent Testing, Validation & Scoring Dashboard** that lets any developer or QA engineer:

1. Define what their agent *should* do (test cases)
2. Run those test cases against any agent API
3. Get a detailed report card — pass/fail, trace diff, semantic scores

**Simple analogy:** Postman + Jest, but for AI agents.

---

## 03 · Core Features

### 3.1 Test Suite Builder
- Create test cases with:
  - **Trigger Prompt** — input sent to the agent
  - **Expected Tool Sequence** — e.g. `search_db → summarize → respond`
  - **Golden Response** — optional expected output for semantic comparison
  - **Assertions** — e.g. must complete in under 4 steps, must pass integer to param X
- Group test cases into named **Test Suites**
- CRUD for suites and cases via dashboard UI

### 3.2 Agent Connector
- User pastes any agent's **API endpoint URL + auth key**
- Framework dispatches test payloads to that endpoint
- Captures full execution trace response
- Harness-agnostic — works with Claude, GPT, Gemini, custom runtimes

### 3.3 Execution Runner
- Run a single test case or full suite
- Dispatches prompts to the connected agent
- Captures:
  - Tool call sequence (name, order, parameters)
  - Number of steps taken
  - Token consumption
  - Raw final response
  - Timestamps per step
- Streams execution progress live via **SSE**

### 3.4 Dual Evaluation Engine

#### Deterministic Assertions
Hard-coded checks — no LLM needed:
- Did the agent call the correct tool?
- Were the tools called in the correct order?
- Were the correct parameter types passed?
- Did it complete within the step limit?
- Does the output contain/not contain a specific string?

#### Semantic Evaluation (LLM-as-Judge via Groq)
Groq evaluates the soft, fluid elements:
- Does the final answer match the intent of the golden response?
- Is there hallucinated data not in the context?
- Is the RAG context retrieved relevant to the prompt?
- Outputs a **semantic drift score** (0–100)

### 3.5 Report Card Dashboard
Per test case result:
- ✅ Pass / ❌ Fail status
- Exact step where agent went off track
- Expected vs actual tool call diff
- Token consumption variance
- Semantic drift score
- Full execution trace timeline

Per suite result:
- Overall pass rate %
- Slowest / most token-heavy test
- Regression comparison (current run vs last run)

---

## 04 · Tech Stack

| Layer | Tech | Hosting |
|-------|------|---------|
| Frontend + API Routes | Next.js 14 (App Router) | Vercel (free) |
| Database | Neon PostgreSQL | Neon free tier |
| ORM | Drizzle ORM | — |
| LLM-as-Judge | Groq API (Llama 3.3 70B) | Free tier |
| Real-time | SSE via Next.js Route Handlers | Built-in |
| Styling | Tailwind CSS + shadcn/ui | — |

---

## 05 · Database Schema

```sql
-- Test Suites
CREATE TABLE test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  agent_url TEXT NOT NULL,
  agent_auth_key TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Test Cases
CREATE TABLE test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID REFERENCES test_suites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_prompt TEXT NOT NULL,
  expected_tool_sequence JSONB,   -- ["tool_a", "tool_b", "tool_c"]
  golden_response TEXT,
  assertions JSONB,               -- [{ type: "step_limit", value: 4 }]
  created_at TIMESTAMP DEFAULT NOW()
);

-- Test Runs
CREATE TABLE test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID REFERENCES test_suites(id),
  status TEXT DEFAULT 'running',  -- running | completed | failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Test Results
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id UUID REFERENCES test_cases(id),
  passed BOOLEAN,
  actual_tool_sequence JSONB,
  token_usage INTEGER,
  step_count INTEGER,
  raw_response TEXT,
  semantic_score INTEGER,         -- 0-100 from Groq judge
  failure_reason TEXT,
  trace JSONB,                    -- full step-by-step trace
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 06 · Folder Structure

```
/
├── app/
│   ├── page.tsx                        # Landing / redirect to dashboard
│   ├── dashboard/
│   │   └── page.tsx                    # Main dashboard — suite list + stats
│   ├── suites/
│   │   ├── page.tsx                    # All test suites
│   │   ├── new/page.tsx                # Create new suite
│   │   └── [id]/
│   │       ├── page.tsx                # Suite detail — test cases list
│   │       ├── run/page.tsx            # Live execution view (SSE)
│   │       └── results/page.tsx        # Report card for last run
│   ├── test-cases/
│   │   ├── new/page.tsx                # Create test case
│   │   └── [id]/page.tsx              # Test case detail + edit
│   └── api/
│       ├── suites/
│       │   ├── route.ts                # GET all, POST create
│       │   └── [id]/route.ts          # GET, PATCH, DELETE
│       ├── test-cases/
│       │   ├── route.ts                # GET all, POST create
│       │   └── [id]/route.ts          # GET, PATCH, DELETE
│       ├── runs/
│       │   ├── route.ts                # POST start a new run
│       │   └── [id]/route.ts          # GET run results
│       ├── stream/
│       │   └── [runId]/route.ts        # SSE — live execution stream
│       └── evaluate/
│           └── route.ts                # Groq LLM-as-Judge endpoint
│
├── lib/
│   ├── db/
│   │   ├── index.ts                    # Neon + Drizzle client
│   │   └── schema.ts                   # Drizzle schema definitions
│   ├── agent-runner.ts                 # Dispatches prompts to external agent
│   ├── assertions.ts                   # Deterministic assertion checks
│   ├── groq-judge.ts                   # Groq LLM-as-Judge logic
│   └── sse.ts                          # SSE helper utilities
│
├── components/
│   ├── suite-card.tsx
│   ├── test-case-form.tsx
│   ├── execution-live-view.tsx         # Real-time SSE trace display
│   ├── report-card.tsx
│   ├── tool-diff.tsx                   # Expected vs actual tool sequence
│   └── semantic-score-badge.tsx
│
├── drizzle.config.ts
├── .env.local
└── PROJECT.md                          # This file
```

---

## 07 · Application Flow

```
1. User creates a Test Suite
   → Name, description, agent API URL, auth key

2. User creates Test Cases inside that suite
   → Trigger prompt + expected tool sequence + golden response + assertions

3. User clicks "Run Suite"
   → POST /api/runs → creates a TestRun record → starts execution

4. Execution Runner (lib/agent-runner.ts)
   → Loops through each test case
   → Dispatches trigger prompt to agent API URL
   → Captures trace (tools called, order, params, tokens, steps)

5. Assertion Engine (lib/assertions.ts)
   → Runs deterministic checks on captured trace
   → Pass/Fail per assertion

6. Groq LLM-as-Judge (lib/groq-judge.ts)
   → Sends [golden response + actual response] to Groq
   → Gets semantic drift score 0-100

7. Results saved to Neon (test_results table)

8. SSE Stream (/api/stream/[runId])
   → Frontend receives live events as each test case completes
   → UI updates in real-time

9. Run completes → Report Card rendered
   → Pass/Fail per test, tool diff, token usage, semantic scores
```

---

## 08 · SSE Event Schema

```ts
// Events emitted during a run
type SSEEvent =
  | { type: "run_started"; totalTests: number }
  | { type: "test_started"; testCaseId: string; name: string }
  | { type: "agent_called"; testCaseId: string }
  | { type: "trace_captured"; testCaseId: string; trace: TraceStep[] }
  | { type: "assertions_evaluated"; testCaseId: string; passed: boolean; failures: string[] }
  | { type: "semantic_scored"; testCaseId: string; score: number }
  | { type: "test_completed"; testCaseId: string; passed: boolean }
  | { type: "run_completed"; passRate: number; totalPassed: number; totalFailed: number }
```

---

## 09 · Key API Routes

```
POST   /api/suites              Create a new test suite
GET    /api/suites              Get all suites
GET    /api/suites/:id          Get suite + its test cases
DELETE /api/suites/:id          Delete suite

POST   /api/test-cases          Create a test case
PATCH  /api/test-cases/:id      Update a test case
DELETE /api/test-cases/:id      Delete a test case

POST   /api/runs                Start a new run (triggers execution)
GET    /api/runs/:id            Get run results

GET    /api/stream/:runId       SSE stream for live execution updates

POST   /api/evaluate            Call Groq LLM-as-Judge (internal use)
```

---

## 10 · Environment Variables

```env
# .env.local

DATABASE_URL=postgresql://...           # Neon connection string
GROQ_API_KEY=gsk_...                    # Groq free tier key
```

---

## 11 · Team Task Split

| Person | Owns |
|--------|------|
| **P1** | Execution Runner + Assertion Engine (`lib/agent-runner.ts`, `lib/assertions.ts`) |
| **P2** | API Routes + Neon DB + Drizzle schema + SSE endpoint |
| **P3** | Frontend — Dashboard, Suite Builder UI, Live Execution View, Report Card |
| **P4** | Groq LLM-as-Judge + semantic scoring + mock agent for testing |

---

## 12 · Build Timeline

```
11:40 AM – 12:30 PM  │ Setup: Next.js scaffold, Neon DB, Drizzle schema, env vars
12:30 PM – 01:30 PM  │ Core: API routes + agent runner + assertion engine
01:30 PM – 02:30 PM  │ Frontend: Suite builder + test case form + basic dashboard
02:30 PM – 03:30 PM  │ Integration: Wire SSE + live execution view + Groq judge
03:30 PM – 04:15 PM  │ Report Card: Pass/fail UI, tool diff, semantic score display
04:15 PM – 04:45 PM  │ Polish: Demo data, edge cases, UI cleanup
04:45 PM – 05:00 PM  │ Deploy to Vercel, final checks
```

---

## 13 · Mock Agent (for demo/testing)

Since you need an agent to test against, P4 should build a simple mock agent endpoint:

```ts
// app/api/mock-agent/route.ts
// Simulates an agent that calls tools and returns a response
// Used to demo the framework without needing an external agent

export async function POST(req: Request) {
  const { prompt } = await req.json()
  
  // Simulate tool calls based on prompt keywords
  return Response.json({
    response: "Here is the answer based on your query...",
    trace: [
      { tool: "search_kb", params: { query: prompt }, result: "..." },
      { tool: "summarize", params: { text: "..." }, result: "..." },
    ],
    token_usage: 342,
    step_count: 2
  })
}
```

This lets P3 build the UI and P1 build the runner without needing a real external agent.

---

## 14 · Judging Criteria Mapping

| Criteria | How we cover it |
|----------|----------------|
| Full-stack end-to-end | Next.js frontend + API routes + Neon DB |
| AI integration | Groq LLM-as-Judge for semantic eval |
| Harness-agnostic | Agent = any API URL, no lock-in |
| Deterministic assertions | `lib/assertions.ts` — hard coded checks |
| Semantic evaluation | Groq judges golden response vs actual |
| Trace verification | Full tool call sequence captured + diffed |
| User accessibility | Clean UI, no code needed to run tests |
| Real-time feedback | SSE live execution stream |

---

*Generated for GDG Kolachi Build With AI 2026 Hackathon*
