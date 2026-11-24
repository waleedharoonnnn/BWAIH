import type { Assertion, AssertionResult, TraceStep } from "./db/schema"

export type { Assertion, AssertionResult, TraceStep }

export type SSEEvent =
  | { type: "test_started"; testCaseId: string; name: string }
  | { type: "trace_captured"; testCaseId: string; trace: TraceStep[]; stepCount?: number }
  | { type: "assertions_evaluated"; testCaseId: string; passed: boolean; results: AssertionResult[] }
  | { type: "semantic_scored"; testCaseId: string; score: number; reasoning: string; hallucinated: boolean }
  | { type: "test_completed"; testCaseId: string; passed: boolean; failureReason?: string; tokenUsage?: number; stepCount?: number }
  | { type: "run_completed"; passRate: number; totalPassed: number; totalFailed: number }
  | { type: "error"; message: string }

export type SemanticJudgeResult = {
  score: number
  reasoning: string
  hallucinated: boolean
}
