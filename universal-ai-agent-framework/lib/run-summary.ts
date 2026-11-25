import { asc, eq } from "drizzle-orm"
import { db } from "./db"
import { testCases, testResults, testRuns, testSuites, type AssertionResult, type TraceStep } from "./db/schema"

export type AttemptRow = {
  testCaseId: string
  attempt: number
  passed: boolean | null
  actualToolSequence: string[] | null
  tokenUsage: number | null
  stepCount: number | null
  rawResponse: string | null
  semanticScore: number | null
  judgeReasoning: string | null
  failureReason: string | null
  assertionResults: AssertionResult[] | null
  trace: TraceStep[] | null
  testCaseName: string | null
  expectedToolSequence: string[] | null
  goldenResponse: string | null
}

export type TestSummary = {
  testCaseId: string
  name: string
  expectedToolSequence: string[] | null
  goldenResponse: string | null
  attempts: AttemptRow[]
  passedAttempts: number
  passRate: number
  status: "passed" | "failed" | "flaky"
  avgSemantic: number | null
  avgTokens: number
  avgSteps: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Groups per-attempt result rows (already ordered) into one summary per test case. */
export function groupAttempts(rows: AttemptRow[]): TestSummary[] {
  const byCase = new Map<string, AttemptRow[]>()
  for (const r of rows) byCase.set(r.testCaseId, [...(byCase.get(r.testCaseId) ?? []), r])

  return [...byCase.values()].map((attempts) => {
    const first = attempts[0]
    const passedAttempts = attempts.filter((a) => a.passed).length
    const scores = attempts.map((a) => a.semanticScore).filter((s): s is number => s !== null)
    return {
      testCaseId: first.testCaseId,
      name: first.testCaseName ?? "Deleted test case",
      expectedToolSequence: first.expectedToolSequence,
      goldenResponse: first.goldenResponse,
      attempts,
      passedAttempts,
      passRate: passedAttempts / attempts.length,
      status: passedAttempts === attempts.length ? "passed" : passedAttempts > 0 ? "flaky" : "failed",
      avgSemantic: scores.length ? Math.round(avg(scores)) : null,
      avgTokens: Math.round(avg(attempts.map((a) => a.tokenUsage ?? 0))),
      avgSteps: Math.round(avg(attempts.map((a) => a.stepCount ?? 0)) * 10) / 10,
    }
  })
}

export async function loadRun(id: string) {
  const [run] = await db
    .select({
      id: testRuns.id,
      suiteId: testRuns.suiteId,
      status: testRuns.status,
      agentUrl: testRuns.agentUrl,
      repeatCount: testRuns.repeatCount,
      passCount: testRuns.passCount,
      failCount: testRuns.failCount,
      flakyCount: testRuns.flakyCount,
      startedAt: testRuns.startedAt,
      completedAt: testRuns.completedAt,
      suiteName: testSuites.name,
    })
    .from(testRuns)
    .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
    .where(eq(testRuns.id, id))
  if (!run) return null

  const rows = await db
    .select({
      testCaseId: testResults.testCaseId,
      attempt: testResults.attempt,
      passed: testResults.passed,
      actualToolSequence: testResults.actualToolSequence,
      tokenUsage: testResults.tokenUsage,
      stepCount: testResults.stepCount,
      rawResponse: testResults.rawResponse,
      semanticScore: testResults.semanticScore,
      judgeReasoning: testResults.judgeReasoning,
      failureReason: testResults.failureReason,
      assertionResults: testResults.assertionResults,
      trace: testResults.trace,
      testCaseName: testCases.name,
      expectedToolSequence: testCases.expectedToolSequence,
      goldenResponse: testCases.goldenResponse,
    })
    .from(testResults)
    .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
    .where(eq(testResults.runId, id))
    .orderBy(asc(testCases.createdAt), asc(testResults.attempt))

  return { run, tests: groupAttempts(rows) }
}
