import type { Assertion, AssertionResult, TraceStep } from "./db/schema"

export type { Assertion, AssertionResult, TraceStep }

export type SSEEvent =
  | { type: "test_started"; testCaseId: string; name: string; attempts: number }
  | { type: "attempt_started"; testCaseId: string; attempt: number }
  | { type: "trace_captured"; testCaseId: string; attempt: number; trace: TraceStep[]; stepCount: number }
  | { type: "assertions_evaluated"; testCaseId: string; attempt: number; passed: boolean; results: AssertionResult[] }
  | { type: "semantic_scored"; testCaseId: string; attempt: number; score: number; reasoning: string; hallucinated: boolean }
  | { type: "attempt_completed"; testCaseId: string; attempt: number; passed: boolean; failureReason?: string; tokenUsage: number; stepCount: number }
  | { type: "test_completed"; testCaseId: string; passed: boolean; flaky: boolean; passedAttempts: number; attempts: number; failureReason?: string; tokenUsage: number; stepCount: number }
  | { type: "run_completed"; passRate: number; totalPassed: number; totalFailed: number; totalFlaky: number }
  | { type: "error"; message: string }

export type SemanticJudgeResult = {
  score: number
  reasoning: string
  hallucinated: boolean
}
