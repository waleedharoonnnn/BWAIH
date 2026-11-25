"use client"

import { useEffect, useReducer } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, ChevronDown, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SSEEvent } from "@/lib/types"

type TestState = {
  id: string
  name: string
  status: "running" | "passed" | "failed" | "flaky"
  attempts: number
  passedAttempts: number
  doneAttempts: number
  tokenUsage: number
  stepCount?: number
  semanticScores: number[]
  failureReason?: string
  logs: string[]
}

type RunState = {
  tests: TestState[]
  passed: number
  failed: number
  flaky: number
  semanticScores: number[]
  totalTokens: number
  finished: boolean
  passRate: number
  error: string | null
}

const initial: RunState = {
  tests: [], passed: 0, failed: 0, flaky: 0, semanticScores: [], totalTokens: 0,
  finished: false, passRate: 0, error: null,
}

function updateTest(state: RunState, id: string, fn: (t: TestState) => TestState): RunState {
  return { ...state, tests: state.tests.map((t) => (t.id === id ? fn(t) : t)) }
}

function reducer(state: RunState, e: SSEEvent): RunState {
  const tag = (t: TestState, attempt: number) => (t.attempts > 1 ? `Attempt ${attempt}/${t.attempts}: ` : "")
  switch (e.type) {
    case "test_started":
      return {
        ...state,
        tests: [...state.tests, {
          id: e.testCaseId, name: e.name, status: "running", attempts: e.attempts, passedAttempts: 0,
          doneAttempts: 0, tokenUsage: 0, semanticScores: [], logs: [],
        }],
      }
    case "attempt_started":
      return updateTest(state, e.testCaseId, (t) => ({ ...t, logs: [...t.logs, `${tag(t, e.attempt)}calling agent…`] }))
    case "trace_captured":
      return updateTest(state, e.testCaseId, (t) => ({
        ...t, stepCount: e.stepCount,
        logs: [...t.logs, `${tag(t, e.attempt)}trace captured — ${e.trace.map((s) => s.tool).join(" → ") || "no tool calls"}`],
      }))
    case "assertions_evaluated": {
      const ok = e.results.filter((r) => r.passed).length
      return updateTest(state, e.testCaseId, (t) => ({
        ...t, logs: [...t.logs, `${tag(t, e.attempt)}assertions ${ok}/${e.results.length} passed`],
      }))
    }
    case "semantic_scored":
      return {
        ...updateTest(state, e.testCaseId, (t) => ({
          ...t, semanticScores: [...t.semanticScores, e.score],
          logs: [...t.logs, `${tag(t, e.attempt)}semantic score ${e.score}/100${e.hallucinated ? " ⚠ possible hallucination" : ""}`],
        })),
        semanticScores: [...state.semanticScores, e.score],
      }
    case "attempt_completed":
      return {
        ...updateTest(state, e.testCaseId, (t) => ({
          ...t,
          doneAttempts: t.doneAttempts + 1,
          passedAttempts: t.passedAttempts + (e.passed ? 1 : 0),
          tokenUsage: t.tokenUsage + e.tokenUsage,
          logs: [...t.logs, `${tag(t, e.attempt)}${e.passed ? "✓ passed" : `✗ failed — ${e.failureReason ?? "unknown reason"}`}`],
        })),
        totalTokens: state.totalTokens + e.tokenUsage,
      }
    case "test_completed": {
      const status = e.passed ? "passed" : e.flaky ? "flaky" : "failed"
      return {
        ...updateTest(state, e.testCaseId, (t) => ({ ...t, status, failureReason: e.failureReason })),
        passed: state.passed + (e.passed ? 1 : 0),
        failed: state.failed + (e.passed ? 0 : 1),
        flaky: state.flaky + (e.flaky ? 1 : 0),
      }
    }
    case "run_completed":
      return { ...state, finished: true, passRate: e.passRate, passed: e.totalPassed, failed: e.totalFailed, flaky: e.totalFlaky }
    case "error":
      return { ...state, error: e.message, finished: true }
    default:
      return state
  }
}

const EVENT_TYPES: SSEEvent["type"][] = [
  "test_started", "attempt_started", "trace_captured", "assertions_evaluated",
  "semantic_scored", "attempt_completed", "test_completed", "run_completed", "error",
]

type Props = { runId: string; suiteName: string; totalCases: number; repeatCount: number }

export function RunLiveFeed({ runId, suiteName, totalCases, repeatCount }: Props) {
  const [state, dispatch] = useReducer(reducer, initial)
  const router = useRouter()

  useEffect(() => {
    const es = new EventSource(`/api/stream/${runId}`)
    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (e: MessageEvent) => {
        try { dispatch({ type, ...JSON.parse(e.data) } as SSEEvent) } catch { /* ignore malformed event */ }
      })
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [runId])

  const doneAttempts = state.tests.reduce((s, t) => s + t.doneAttempts, 0)
  const totalAttempts = totalCases * repeatCount
  const progressPct = state.finished ? 100 : totalAttempts > 0 ? Math.round((doneAttempts / totalAttempts) * 100) : 0
  const avgSemantic = state.semanticScores.length
    ? Math.round(state.semanticScores.reduce((a, b) => a + b, 0) / state.semanticScores.length)
    : null
  const completed = state.tests.filter((t) => t.status !== "running").length

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground">
            Running: <span className="font-semibold">{suiteName}</span>
            {repeatCount > 1 && <span className="ml-2 text-xs text-muted-foreground">({repeatCount} attempts per test)</span>}
          </span>
          <span className="text-xs text-muted-foreground">{completed}/{totalCases} tests</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              state.finished ? (state.failed === 0 ? "bg-emerald-500" : "bg-red-500") : "bg-primary"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {state.error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
          Error: {state.error}
        </div>
      )}

      <div className={cn("grid gap-2", repeatCount > 1 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-5")}>
        {[
          { label: "Passed", value: state.passed, color: "text-emerald-500" },
          { label: "Failed", value: state.failed, color: "text-red-500" },
          ...(repeatCount > 1 ? [{ label: "Flaky", value: state.flaky, color: "text-amber-500" }] : []),
          { label: "Pass Rate", value: state.finished ? `${state.passRate}%` : "—", color: "text-foreground" },
          { label: "Avg Semantic", value: avgSemantic !== null ? `${avgSemantic}/100` : "—", color: "text-foreground" },
          { label: "Total Tokens", value: state.totalTokens > 0 ? state.totalTokens.toLocaleString() : "—", color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3 text-center">
            <div className={cn("text-lg font-bold", s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {state.tests.map((test) => <TestCard key={test.id} test={test} />)}
        {state.tests.length === 0 && !state.error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for tests to start…
          </div>
        )}
      </div>

      {state.finished && (
        <div className="flex justify-center">
          <button
            onClick={() => router.push(`/runs/${runId}`)}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md transition-colors"
          >
            View Full Report
          </button>
        </div>
      )}
    </div>
  )
}

function TestCard({ test }: { test: TestState }) {
  const avgSem = test.semanticScores.length
    ? Math.round(test.semanticScores.reduce((a, b) => a + b, 0) / test.semanticScores.length)
    : null

  return (
    <details className="group bg-card border border-border rounded-lg overflow-hidden" open={test.status === "running"}>
      <summary className="flex items-center gap-3 px-3 py-2.5 cursor-pointer list-none hover:bg-muted/30 select-none transition-colors">
        <span className="flex-shrink-0">
          {test.status === "running" && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
          {test.status === "passed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          {test.status === "failed" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
          {test.status === "flaky" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
        </span>
        <span className={cn("text-sm font-medium flex-1 min-w-0 truncate", test.status === "failed" ? "text-destructive" : "text-foreground")}>
          {test.name}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
          {test.attempts > 1 && (
            <span className={cn(
              "font-semibold",
              test.status === "flaky" ? "text-amber-500" : test.status === "failed" ? "text-red-500" : test.status === "passed" ? "text-emerald-500" : ""
            )}>
              {test.passedAttempts}/{test.doneAttempts || test.attempts} passed{test.status === "flaky" ? " · flaky" : ""}
            </span>
          )}
          {test.stepCount !== undefined && <span className="hidden sm:inline">{test.stepCount} steps</span>}
          {test.tokenUsage > 0 && <span className="hidden sm:inline">{test.tokenUsage.toLocaleString()} tokens</span>}
          {avgSem !== null && (
            <span className={cn("font-semibold", avgSem >= 80 ? "text-emerald-500" : avgSem >= 50 ? "text-amber-500" : "text-destructive")}>
              {avgSem}/100
            </span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0" />
      </summary>
      <div className="px-3 pb-2.5 pt-2 border-t border-border space-y-1">
        {test.logs.map((log, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
            <span className="break-words">{log}</span>
          </div>
        ))}
        {test.status === "running" && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing…
          </div>
        )}
      </div>
    </details>
  )
}
