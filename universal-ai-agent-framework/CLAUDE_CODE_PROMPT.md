# Claude Code Prompt — Universal AI Agent Testing Framework
> Paste everything below this line into Claude Code

---

You are building a **Universal AI Agent Testing Framework** — a full-stack Next.js web application that allows developers and QA engineers to test any AI agent against structured test cases and get detailed pass/fail reports with semantic scoring.

This is a **hackathon project**. Build fast, build complete, build production-quality. No placeholders. No "TODO" comments. Every feature must be fully functional and wired end-to-end.

---

## EXISTING PROJECT SETUP

The project is already initialized with:
- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Groq SDK** (already installed, `GROQ_API_KEY` in `.env.local`)

You need to install and configure:
- `neon` + `drizzle-orm` + `drizzle-kit` — database
- `@neondatabase/serverless` — Neon serverless driver
- `shadcn/ui` — UI components
- `lucide-react` — icons
- `zod` — validation
- `eventsource-parser` — SSE parsing on client

---

## DESIGN SYSTEM (STRICT — DO NOT DEVIATE)

```
Font:          Inter (already in Tailwind, use font-sans)
Primary:       #2563EB  (blue-600)
Primary Hover: #1D4ED8  (blue-700)
Primary Light: #EFF6FF  (blue-50)
Primary Mid:   #DBEAFE  (blue-100)
Background:    #FFFFFF
Surface:       #F8FAFC  (slate-50)
Border:        #E2E8F0  (slate-200)
Text Primary:  #0F172A  (slate-900)
Text Muted:    #64748B  (slate-500)
Text XMuted:   #94A3B8  (slate-400)
Success:       #16A34A  (green-600)
Success Light: #F0FDF4  (green-50)
Error:         #DC2626  (red-600)
Error Light:   #FEF2F2  (red-50)
Warning:       #D97706  (amber-600)
Warning Light: #FFFBEB  (amber-50)
```

**UI Rules:**
- Clean, minimal, utility-first — think Linear/Vercel dashboard aesthetic
- Cards use `bg-white border border-slate-200 rounded-xl shadow-sm`
- All buttons use `rounded-lg` not `rounded-full`
- Sidebar navigation, fixed left, 240px wide
- Main content area has `max-w-5xl mx-auto px-6 py-8`
- Tables use full-width with `divide-y divide-slate-200`
- Status badges: pill shaped `rounded-full px-2.5 py-0.5 text-xs font-medium`
- No gradients except subtle `from-blue-50 to-white` on hero areas
- Page titles: `text-2xl font-semibold text-slate-900`
- Section labels: `text-xs font-medium text-slate-500 uppercase tracking-wider`

---

## DATABASE SETUP

### 1. Install dependencies
```bash
npm install @neondatabase/serverless drizzle-orm drizzle-kit dotenv
npm install -D @types/pg
```

### 2. Create `lib/db/schema.ts`

```ts
import { pgTable, uuid, text, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core"

export const testSuites = pgTable("test_suites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  agentUrl: text("agent_url").notNull(),
  agentAuthKey: text("agent_auth_key"),
  createdAt: timestamp("created_at").defaultNow(),
})

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id").references(() => testSuites.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  triggerPrompt: text("trigger_prompt").notNull(),
  expectedToolSequence: jsonb("expected_tool_sequence").$type<string[]>(),
  goldenResponse: text("golden_response"),
  assertions: jsonb("assertions").$type<Assertion[]>(),
  createdAt: timestamp("created_at").defaultNow(),
})

export const testRuns = pgTable("test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id").references(() => testSuites.id).notNull(),
  status: text("status").notNull().default("running"), // running | completed | failed
  passCount: integer("pass_count").default(0),
  failCount: integer("fail_count").default(0),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
})

export const testResults = pgTable("test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => testRuns.id, { onDelete: "cascade" }).notNull(),
  testCaseId: uuid("test_case_id").references(() => testCases.id).notNull(),
  passed: boolean("passed"),
  actualToolSequence: jsonb("actual_tool_sequence").$type<string[]>(),
  tokenUsage: integer("token_usage"),
  stepCount: integer("step_count"),
  rawResponse: text("raw_response"),
  semanticScore: integer("semantic_score"),
  failureReason: text("failure_reason"),
  assertionResults: jsonb("assertion_results").$type<AssertionResult[]>(),
  trace: jsonb("trace").$type<TraceStep[]>(),
  createdAt: timestamp("created_at").defaultNow(),
})

// Types
export type Assertion = {
  type: "tool_called" | "tool_order" | "step_limit" | "param_type" | "output_contains" | "output_not_contains"
  value: string | number | string[]
  description: string
}

export type AssertionResult = {
  assertion: Assertion
  passed: boolean
  actual: string | number | null
  message: string
}

export type TraceStep = {
  step: number
  tool: string
  params: Record<string, unknown>
  result: string
  timestamp: number
}
```

### 3. Create `lib/db/index.ts`

```ts
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

### 4. Create `drizzle.config.ts`

```ts
import type { Config } from "drizzle-kit"

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config
```

### 5. Add to `.env.local`
```
DATABASE_URL=postgresql://...  # User provides this from Neon dashboard
GROQ_API_KEY=gsk_...           # Already exists
```

### 6. Run migration
```bash
npx drizzle-kit push:pg
```

---

## SEED DATA

Create `lib/seed.ts` — run this once to populate demo data:

```ts
// Creates:
// - 2 test suites (one pointing to mock agent, one to a failing agent)
// - 5 test cases per suite with varied assertions
// - Realistic tool sequences, golden responses
// - Pre-run results for the dashboard to show immediately
```

Implement fully. Use realistic AI agent scenarios (RAG search, summarization, classification agents).

---

## MOCK AGENT

Create `app/api/mock-agent/route.ts`:

A realistic mock agent that:
- Accepts `POST { prompt: string }`
- Simulates tool calls based on prompt keywords
- Returns a structured trace response
- Has configurable failure modes (pass `?mode=fail` or `?mode=hallucinate`)

```ts
// Response shape the runner expects:
{
  response: string,
  trace: TraceStep[],
  token_usage: number,
  step_count: number
}
```

Build 3 modes:
1. **Normal** — correct tool sequence, good response
2. **Fail** — wrong tool called, bad order
3. **Hallucinate** — correct tools, but response contains made-up data

---

## CORE LIBRARY FILES

### `lib/agent-runner.ts`
Dispatches a test case to an external agent URL and returns the raw trace:

```ts
export async function runTestCase(
  agentUrl: string,
  authKey: string | null,
  triggerPrompt: string
): Promise<{ trace: TraceStep[]; response: string; tokenUsage: number; stepCount: number }>
```

- Uses `fetch` with proper headers
- Handles auth header if key provided
- Timeout after 30 seconds
- Throws structured errors on failure

### `lib/assertions.ts`
Runs all deterministic assertions against a trace result:

```ts
export function runAssertions(
  assertions: Assertion[],
  result: { trace: TraceStep[]; response: string; stepCount: number }
): AssertionResult[]
```

Implement all assertion types:
- `tool_called` — checks if a specific tool appears in trace
- `tool_order` — checks exact sequence matches expected
- `step_limit` — checks stepCount <= value
- `param_type` — checks a tool's param is the right JS type
- `output_contains` — checks response includes string
- `output_not_contains` — checks response does NOT include string

### `lib/groq-judge.ts`
LLM-as-Judge using Groq:

```ts
export async function judgeSemanticSimilarity(
  goldenResponse: string,
  actualResponse: string,
  originalPrompt: string
): Promise<{ score: number; reasoning: string; hallucinated: boolean }>
```

Prompt Groq (llama-3.3-70b-versatile) to:
- Score semantic similarity 0-100
- Detect hallucinated facts
- Return JSON only
- Be strict — penalize off-topic answers heavily

### `lib/sse.ts`
SSE helper:

```ts
export function createSSEStream(): {
  stream: ReadableStream
  emit: (event: string, data: unknown) => void
  close: () => void
}
```

---

## API ROUTES

Build all routes with proper Zod validation, error handling, and correct HTTP status codes.

### `app/api/suites/route.ts`
- `GET` — return all suites with test case count
- `POST` — create suite (validate: name required, agentUrl must be valid URL)

### `app/api/suites/[id]/route.ts`
- `GET` — return suite + all its test cases
- `PATCH` — update suite fields
- `DELETE` — delete suite + cascade

### `app/api/test-cases/route.ts`
- `POST` — create test case with full validation

### `app/api/test-cases/[id]/route.ts`
- `GET` — single test case
- `PATCH` — update
- `DELETE` — delete

### `app/api/runs/route.ts`
- `POST { suiteId }` — creates a TestRun record, returns `{ runId }`
- Does NOT execute the run (execution happens in SSE stream)

### `app/api/runs/[id]/route.ts`
- `GET` — returns run + all results + test case names

### `app/api/stream/[runId]/route.ts`
**This is the most critical route.**

```ts
export async function GET(req: Request, { params }: { params: { runId: string } }) {
  // 1. Fetch the run + its suite + test cases
  // 2. Create SSE stream
  // 3. For each test case:
  //    a. Emit: test_started
  //    b. Call agent-runner.ts → get trace
  //    c. Emit: trace_captured
  //    d. Run assertions → emit: assertions_evaluated
  //    e. If golden response exists → call groq-judge → emit: semantic_scored
  //    f. Save result to DB
  //    g. Emit: test_completed { passed, failureReason }
  // 4. Update run status to "completed"
  // 5. Emit: run_completed { passRate, totalPassed, totalFailed }
  // 6. Close stream
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
```

SSE event format:
```
data: {"type":"test_started","testCaseId":"...","name":"..."}

data: {"type":"trace_captured","testCaseId":"...","trace":[...]}

data: {"type":"assertions_evaluated","testCaseId":"...","passed":true,"results":[...]}

data: {"type":"semantic_scored","testCaseId":"...","score":87,"reasoning":"..."}

data: {"type":"test_completed","testCaseId":"...","passed":true}

data: {"type":"run_completed","passRate":80,"totalPassed":4,"totalFailed":1}
```

### `app/api/evaluate/route.ts`
- `POST { goldenResponse, actualResponse, prompt }` → calls groq-judge → returns score

---

## FRONTEND PAGES

### Layout: `app/layout.tsx`
- Inter font via `next/font/google`
- Sidebar layout wrapper
- Global styles

### Sidebar Component: `components/sidebar.tsx`
Fixed left sidebar (240px):
```
Logo: "AgentTest" with a small circuit/test icon (use lucide)

Navigation:
  - Dashboard          /dashboard
  - Test Suites        /suites
  - Run History        /runs

Bottom:
  - Docs link (mock)
  - Settings (mock)
```

Active state: `bg-blue-50 text-blue-600 font-medium`
Inactive: `text-slate-600 hover:bg-slate-50`

### Page 1: `/dashboard` — Dashboard Overview

Show:
- Stats row: Total Suites, Total Test Cases, Total Runs, Avg Pass Rate
  - Each stat in a card with icon, number, label
- Recent Runs table (last 10): Suite name | Status | Pass Rate | Tests | Started At | Actions
- Quick Actions: "New Suite" button, "Run Last Suite" button

### Page 2: `/suites` — Test Suites List

Show:
- Page header with "Test Suites" title + "New Suite" button
- Table of all suites: Name | Agent URL | Test Cases | Last Run | Created | Actions
- Actions: View, Run, Delete
- Empty state: helpful illustration/message with "Create your first test suite" CTA

### Page 3: `/suites/new` — Create Suite

Form with:
- Suite Name (required)
- Description (optional)
- Agent API URL (required, validate URL format)
- Agent Auth Key (optional, password input)
- Submit → redirect to `/suites/[id]`

### Page 4: `/suites/[id]` — Suite Detail

Show:
- Suite header: name, agent URL (truncated), description
- Action buttons: "Run Suite", "Edit Suite", "Delete Suite"
- Test Cases section with "Add Test Case" button
- Test cases table: Name | Expected Tools | Assertions | Golden Response | Actions
- Empty state for test cases

### Page 5: `/suites/[id]/test-cases/new` — Create Test Case

Form with these sections:

**Basic Info:**
- Test Case Name
- Trigger Prompt (textarea)

**Expected Behavior:**
- Expected Tool Sequence (dynamic input — add/remove tool names as tags)
- Golden Response (textarea, optional)

**Assertions (dynamic list — add/remove):**
Each assertion has:
- Type dropdown: `tool_called | tool_order | step_limit | param_type | output_contains | output_not_contains`
- Value input (changes based on type)
- Description input

Submit → redirect back to suite detail

### Page 6: `/suites/[id]/run` — Live Execution View

This is the most important UI page.

Layout:
- Header: "Running Suite: [name]" + progress bar (X/Y tests)
- Left panel (60%): Live test case feed
- Right panel (40%): Current execution stats

Left panel shows test cases as they execute:
```
[spinning icon] Running: "Test Case Name"
  → agent called...
  → trace captured (3 steps)
  → assertions: 3/4 passed
  → semantic score: 87/100
[✅ PASSED] or [❌ FAILED: reason here]
```

Each completed test case collapses into a summary row.
Failed test cases show the failure reason in red.

Right panel shows:
- Tests Passed: X
- Tests Failed: X  
- Pass Rate: X%
- Avg Semantic Score: X
- Total Tokens Used: X

On completion:
- Progress bar turns green (all pass) or red (any fail)
- "View Full Report" button appears

SSE connection implementation:
```tsx
useEffect(() => {
  const es = new EventSource(`/api/stream/${runId}`)
  es.onmessage = (e) => {
    const event = JSON.parse(e.data)
    // handle each event type and update state
  }
  es.onerror = () => es.close()
  return () => es.close()
}, [runId])
```

### Page 7: `/runs/[id]` — Report Card

Full detailed results page.

Header section:
- Suite name, run timestamp, overall pass rate badge
- Stats: Total | Passed | Failed | Avg Semantic Score | Total Tokens

Results table (one row per test case):
- Status badge (✅ Pass / ❌ Fail)
- Test case name
- Steps taken
- Token usage
- Semantic score (colored: green >80, amber 50-79, red <50)
- "Details" expand button

Expanded detail view (accordion):
- **Trace Timeline**: step-by-step tool calls with params
- **Tool Diff**: Expected sequence vs Actual sequence (side by side, highlight mismatches in red)
- **Assertion Results**: each assertion with pass/fail + actual value
- **Semantic Analysis**: score, reasoning from Groq, hallucination flag

### Page 8: `/runs` — Run History

Table of all runs:
- Suite Name | Status | Pass Rate | Tests | Started | Duration | Actions
- Actions: View Report, Re-run

---

## COMPONENTS TO BUILD

### `components/stats-card.tsx`
```tsx
// Props: title, value, icon, trend (optional)
// Clean card with icon, big number, label
```

### `components/status-badge.tsx`
```tsx
// Props: status: "passed" | "failed" | "running" | "pending"
// Pill badge with dot indicator
```

### `components/tool-sequence-diff.tsx`
```tsx
// Props: expected: string[], actual: string[]
// Side-by-side comparison
// Matching tools: green, missing tools: red, extra tools: amber
```

### `components/assertion-builder.tsx`
```tsx
// Dynamic form for adding/removing assertions
// Type-aware value inputs
```

### `components/tag-input.tsx`
```tsx
// For expected tool sequence input
// Type tool name, press Enter to add, click X to remove
```

### `components/trace-timeline.tsx`
```tsx
// Props: trace: TraceStep[]
// Vertical timeline showing each tool call
// Step number, tool name, params (collapsible), result
```

### `components/semantic-score-ring.tsx`
```tsx
// Props: score: number
// Circular progress ring
// Color: green >80, amber 50-79, red <50
// Score number in center
```

### `components/run-live-feed.tsx`
```tsx
// The SSE-connected live execution component
// Manages EventSource connection
// Renders test case execution states in real-time
```

---

## NAVIGATION FLOW

```
/ → redirect to /dashboard

/dashboard
  → click suite → /suites/[id]
  → click run → /runs/[id]
  → "New Suite" → /suites/new

/suites
  → click suite name → /suites/[id]
  → "New Suite" → /suites/new

/suites/new
  → submit → /suites/[id]

/suites/[id]
  → "Run Suite" → POST /api/runs → redirect to /suites/[id]/run?runId=xxx
  → "Add Test Case" → /suites/[id]/test-cases/new

/suites/[id]/run?runId=xxx
  → SSE connects to /api/stream/[runId]
  → on complete → show "View Full Report" → /runs/[runId]

/runs/[id]
  → "Re-run" → POST /api/runs → redirect to live run page
```

---

## ERROR HANDLING RULES

- Every API route must return proper status codes (400, 404, 500)
- Every API route wraps logic in try/catch
- Frontend shows toast-style error messages on API failures (build a simple `useToast` hook)
- SSE errors: show error state in UI, offer retry button
- Agent timeout (30s): treated as a failed test case, not a crash
- DB connection errors: log and return 500 with message

---

## LOADING STATES

Every page must have:
- Skeleton loaders while data loads (use Tailwind `animate-pulse`)
- Disabled buttons during async operations
- Loading spinner in button when submitting forms

---

## TYPESCRIPT RULES

- No `any` types anywhere
- All API responses have typed interfaces in `lib/types.ts`
- All DB queries are type-safe via Drizzle
- All forms use Zod schemas for validation
- Use `'use client'` only where necessary (forms, SSE, interactive components)

---

## FILE CREATION ORDER (follow this exactly)

1. Install all dependencies
2. `lib/db/schema.ts` + `lib/db/index.ts` + `drizzle.config.ts`
3. Run `npx drizzle-kit push:pg`
4. `lib/types.ts`
5. `lib/assertions.ts`
6. `lib/groq-judge.ts`
7. `lib/agent-runner.ts`
8. `lib/sse.ts`
9. `app/api/mock-agent/route.ts`
10. All API routes (suites, test-cases, runs, stream, evaluate)
11. `lib/seed.ts` → run it
12. `components/` — all shared components
13. `app/layout.tsx` + `components/sidebar.tsx`
14. All pages in order: dashboard → suites → suites/new → suites/[id] → test-cases/new → run → runs/[id] → runs

---

## FINAL CHECKLIST (verify before finishing)

- [ ] `npx drizzle-kit push:pg` ran successfully
- [ ] Seed data inserted — dashboard shows data on first load
- [ ] Mock agent works at `/api/mock-agent` (test with curl)
- [ ] Can create a suite and test cases via UI
- [ ] "Run Suite" triggers SSE and live view updates in real-time
- [ ] Report card shows tool diff, assertion results, semantic scores
- [ ] All pages have loading states
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] Runs on `npm run dev` without errors
- [ ] All navigation links work correctly
- [ ] Empty states on all list pages

---

## IMPORTANT NOTES

- The mock agent endpoint (`/api/mock-agent`) should be pre-configured as the default agent URL in the seed data so the demo works immediately without needing a real external agent
- The Groq API key is already in `.env.local` as `GROQ_API_KEY`
- Use `DATABASE_URL` for Neon — remind user to add it to `.env.local`
- Do NOT use `app/api/stream` with Edge Runtime — use Node.js runtime for SSE (`export const runtime = "nodejs"`)
- Drizzle push may need `--accept-data-loss` flag on first run
- All monetary/score values are integers in DB (semantic score is 0-100 integer)

---

Build the complete application now. Start with dependencies and database, then work through the file creation order. Do not stop until every item in the final checklist is complete.
