"use client"

import { useEffect, useReducer, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SSEEvent, TraceStep, AssertionResult } from "@/lib/types"

type TestState = {
  id: string
  name: string
  status: "pending" | "running" | "passed" | "failed"
  trace?: TraceStep[]
  stepCount?: number
  tokenUsage?: number
  assertionsPassed?: boolean
  assertionResults?: AssertionResult[]
  semanticScore?: number
  semanticReasoning?: string
  hallucinated?: boolean
  failureReason?: string
  logs: string[]
}

type RunState = {
  tests: TestState[]
  passed: number
  failed: number
  avgSemantic: number
  totalTokens: number
  semanticScores: number[]
  finished: boolean
  passRate: number
  error: string | null
}

type Action =
  | { type: "TEST_STARTED"; id: string; name: string }
  | { type: "TRACE_CAPTURED"; id: string; trace: TraceStep[]; stepCount: number; tokenUsage?: number }
  | { type: "ASSERTIONS_EVALUATED"; id: string; passed: boolean; results: AssertionResult[] }
  | { type: "SEMANTIC_SCORED"; id: string; score: number; reasoning: string; hallucinated: boolean }
  | { type: "TEST_COMPLETED"; id: string; passed: boolean; failureReason?: string; tokenUsage?: number }
  | { type: "RUN_COMPLETED"; passRate: number; totalPassed: number; totalFailed: number }
  | { type: "ERROR"; message: string }

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "TEST_STARTED":
      return {
        ...state,
        tests: [...state.tests, { id: action.id, name: action.name, status: "running", logs: ["Agent called..."] }],
      }
    case "TRACE_CAPTURED":
      return {
        ...state,
        tests: state.tests.map((t) =>
          t.id === action.id
            ? { ...t, trace: action.trace, stepCount: action.stepCount, tokenUsage: action.tokenUsage, logs: [...t.logs, `Trace captured (${action.stepCount} steps)`] }
            : t
        ),
      }
    case "ASSERTIONS_EVALUATED": {
      const passed = action.results.filter((r) => r.passed).length
      return {
        ...state,
        tests: state.tests.map((t) =>
          t.id === action.id
            ? { ...t, assertionsPassed: action.passed, assertionResults: action.results, logs: [...t.logs, `Assertions: ${passed}/${action.results.length} passed`] }
            : t
        ),
      }
    }
    case "SEMANTIC_SCORED": {
      const newScores = [...state.semanticScores, action.score]
      return {
        ...state,
        semanticScores: newScores,
        avgSemantic: Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length),
        tests: state.tests.map((t) =>
          t.id === action.id
            ? { ...t, semanticScore: action.score, semanticReasoning: action.reasoning, hallucinated: action.hallucinated, logs: [...t.logs, `Semantic score: ${action.score}/100${action.hallucinated ? " ⚠️ hallucination detected" : ""}`] }
            : t
        ),
      }
    }
    case "TEST_COMPLETED": {
      const tokenDelta = action.tokenUsage ?? 0
      return {
        ...state,
        passed: action.passed ? state.passed + 1 : state.passed,
        failed: !action.passed ? state.failed + 1 : state.failed,
        totalTokens: state.totalTokens + tokenDelta,
        tests: state.tests.map((t) =>
          t.id === action.id
            ? { ...t, status: action.passed ? "passed" : "failed", failureReason: action.failureReason, tokenUsage: action.tokenUsage ?? t.tokenUsage }
            : t
        ),
      }
    }
    case "RUN_COMPLETED":
      return { ...state, finished: true, passRate: action.passRate, passed: action.totalPassed, failed: action.totalFailed }
    case "ERROR":
      return { ...state, error: action.message, finished: true }
    default:
      return state
  }
}

const initial: RunState = {
  tests: [], passed: 0, failed: 0, avgSemantic: 0, totalTokens: 0,
  semanticScores: [], finished: false, passRate: 0, error: null,
}

type Props = {
  runId: string
  suiteName: string
  totalCases: number
}

export function RunLiveFeed({ runId, suiteName, totalCases }: Props) {
  const [state, dispatch] = useReducer(reducer, initial)
  const router = useRouter()

  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case "test_started":
        dispatch({ type: "TEST_STARTED", id: event.testCaseId, name: event.name }); break
      case "trace_captured":
        dispatch({ type: "TRACE_CAPTURED", id: event.testCaseId, trace: event.trace, stepCount: event.trace.length }); break
      case "assertions_evaluated":
        dispatch({ type: "ASSERTIONS_EVALUATED", id: event.testCaseId, passed: event.passed, results: event.results }); break
      case "semantic_scored":
        dispatch({ type: "SEMANTIC_SCORED", id: event.testCaseId, score: event.score, reasoning: event.reasoning, hallucinated: event.hallucinated }); break
      case "test_completed":
        dispatch({ type: "TEST_COMPLETED", id: event.testCaseId, passed: event.passed, failureReason: event.failureReason, tokenUsage: event.tokenUsage }); break
      case "run_completed":
        dispatch({ type: "RUN_COMPLETED", passRate: event.passRate, totalPassed: event.totalPassed, totalFailed: event.totalFailed }); break
      case "error":
        dispatch({ type: "ERROR", message: event.message }); break
    }
  }, [])

  useEffect(() => {
    const es = new EventSource(`/api/stream/${runId}`)
    es.addEventListener("message", (e) => {
      try { handleEvent(JSON.parse(e.data) as SSEEvent) } catch { /* ignore */ }
    })
    const events: SSEEvent["type"][] = ["test_started", "trace_captured", "assertions_evaluated", "semantic_scored", "test_completed", "run_completed", "error"]
    events.forEach((evtName) => {
      es.addEventListener(evtName, (e: MessageEvent) => {
        try { handleEvent({ type: evtName, ...JSON.parse(e.data) } as SSEEvent) } catch { /* ignore */ }
      })
    })
    es.onerror = () => { es.close() }
    return () => es.close()
  }, [runId, handleEvent])

  const completed = state.tests.filter((t) => t.status !== "running" && t.status !== "pending").length
  const progressPct = totalCases > 0 ? Math.round((completed / totalCases) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground">
            Running: <span className="font-semibold">{suiteName}</span>
          </span>
          <span className="text-xs text-muted-foreground">{completed}/{totalCases} tests</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              state.finished
                ? state.failed === 0 ? "bg-emerald-500" : "bg-red-500"
                : "bg-primary"
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

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Passed", value: state.passed, color: "text-emerald-500" },
          { label: "Failed", value: state.failed, color: "text-red-500" },
          { label: "Pass Rate", value: `${state.passRate}%`, color: "text-foreground" },
          { label: "Avg Semantic", value: state.avgSemantic > 0 ? `${state.avgSemantic}/100` : "—", color: "text-foreground" },
          { label: "Total Tokens", value: state.totalTokens > 0 ? state.totalTokens : "—", color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3 text-center">
            <div className={cn("text-lg font-bold", s.color)}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Test cards */}
      <div className="space-y-1.5">
        {state.tests.map((test) => (
          <TestCard key={test.id} test={test} />
        ))}
        {state.tests.length === 0 && (
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
  const isRunning = test.status === "running"
  const isPassed = test.status === "passed"
  const isFailed = test.status === "failed"

  return (
    <details className="group bg-card border border-border rounded-lg overflow-hidden">
      <summary className="flex items-center gap-3 px-3 py-2.5 cursor-pointer list-none hover:bg-muted/30 select-none transition-colors">
        <span className="flex-shrink-0">
          {isRunning && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
          {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          {isFailed && <XCircle className="w-3.5 h-3.5 text-red-500" />}
        </span>
        <span className={cn("text-sm font-medium flex-1", isFailed ? "text-destructive" : "text-foreground")}>
          {test.name}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {test.stepCount !== undefined && <span>{test.stepCount} steps</span>}
          {test.tokenUsage !== undefined && <span>{test.tokenUsage} tokens</span>}
          {test.semanticScore !== undefined && (
            <span className={cn(
              "font-semibold",
              test.semanticScore >= 80 ? "text-emerald-500" :
              test.semanticScore >= 50 ? "text-amber-500" :
              "text-destructive"
            )}>
              {test.semanticScore}/100 sem
            </span>
          )}
        </div>
        {isFailed && test.failureReason && (
          <span className="text-xs text-destructive truncate max-w-[180px]">{test.failureReason}</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-open:rotate-180 transition-transform" />
      </summary>
      <div className="px-3 pb-2.5 pt-2 border-t border-border space-y-1">
        {test.logs.map((log, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
            {log}
          </div>
        ))}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing…
          </div>
        )}
      </div>
    </details>
  )
}
