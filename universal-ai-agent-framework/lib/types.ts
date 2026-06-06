import type { Assertion, AssertionResult, TraceStep } from "./db/schema"

export type { Assertion, AssertionResult, TraceStep }

export type SuiteWithCount = {
  id: string
  name: string
  description: string | null
  agentUrl: string
  agentAuthKey: string | null
  createdAt: Date | null
  testCaseCount: number
}

export type TestCaseRow = {
  id: string
  suiteId: string
  name: string
  triggerPrompt: string
  expectedToolSequence: string[] | null
  goldenResponse: string | null
  assertions: Assertion[] | null
  createdAt: Date | null
}

export type TestRunRow = {
  id: string
  suiteId: string
  status: string
  passCount: number | null
  failCount: number | null
  startedAt: Date | null
  completedAt: Date | null
}

export type TestRunWithSuite = TestRunRow & {
  suiteName: string
  totalTests: number
}

export type TestResultRow = {
  id: string
  runId: string
  testCaseId: string
  passed: boolean | null
  actualToolSequence: string[] | null
  tokenUsage: number | null
  stepCount: number | null
  rawResponse: string | null
  semanticScore: number | null
  failureReason: string | null
  assertionResults: AssertionResult[] | null
  trace: TraceStep[] | null
  createdAt: Date | null
  testCaseName: string
}

export type AgentResponse = {
  response: string
  trace: TraceStep[]
  token_usage: number
  step_count: number
}

export type SSEEvent =
  | { type: "test_started"; testCaseId: string; name: string }
  | { type: "trace_captured"; testCaseId: string; trace: TraceStep[] }
  | { type: "assertions_evaluated"; testCaseId: string; passed: boolean; results: AssertionResult[] }
  | { type: "semantic_scored"; testCaseId: string; score: number; reasoning: string; hallucinated: boolean }
  | { type: "test_completed"; testCaseId: string; passed: boolean; failureReason?: string; tokenUsage?: number; stepCount?: number }
  | { type: "run_completed"; passRate: number; totalPassed: number; totalFailed: number }
  | { type: "error"; message: string }

export type DashboardStats = {
  totalSuites: number
  totalTestCases: number
  totalRuns: number
  avgPassRate: number
}

export type SemanticJudgeResult = {
  score: number
  reasoning: string
  hallucinated: boolean
}
