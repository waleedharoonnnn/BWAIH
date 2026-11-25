import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { testRuns, testCases, testResults, testSuites, type Assertion, type AssertionResult, type TraceStep } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runTestCase, AgentRunnerError } from "@/lib/agent-runner"
import { runAssertions } from "@/lib/assertions"
import { judgeSemanticSimilarity } from "@/lib/groq-judge"
import { createSSEStream } from "@/lib/sse"

export const runtime = "nodejs"
export const maxDuration = 300

// Stop starting new attempts after this, so the run is always finalized before Vercel kills the function.
const TIME_BUDGET_MS = 260_000
const SEMANTIC_THRESHOLD = 50

type TestCase = typeof testCases.$inferSelect
type Suite = typeof testSuites.$inferSelect

type AttemptResult = {
  passed: boolean
  failureReason: string | null
  trace: TraceStep[] | null
  tokenUsage: number
  stepCount: number
  rawResponse: string
  semanticScore: number | null
  judgeReasoning: string | null
  assertionResults: AssertionResult[] | null
}

async function runAttempt(
  tc: TestCase,
  suite: Suite,
  agentUrl: string,
  attempt: number,
  emit: (event: string, data: unknown) => void
): Promise<AttemptResult> {
  const result: AttemptResult = {
    passed: false, failureReason: null, trace: null, tokenUsage: 0, stepCount: 0,
    rawResponse: "", semanticScore: null, judgeReasoning: null, assertionResults: null,
  }

  try {
    const agent = await runTestCase(agentUrl, suite.agentAuthKey, tc.triggerPrompt)
    result.trace = agent.trace
    result.tokenUsage = agent.tokenUsage
    result.stepCount = agent.stepCount
    result.rawResponse = agent.response
    emit("trace_captured", { testCaseId: tc.id, attempt, trace: agent.trace, stepCount: agent.stepCount })

    const assertions: Assertion[] = [
      ...(tc.expectedToolSequence?.length
        ? [{ type: "tool_order" as const, value: tc.expectedToolSequence, description: "Expected tool sequence" }]
        : []),
      ...(tc.assertions ?? []),
    ]
    let assertionsPassed = true
    if (assertions.length > 0) {
      const results = runAssertions(assertions, { trace: agent.trace, response: agent.response, stepCount: agent.stepCount })
      result.assertionResults = results
      assertionsPassed = results.every((r) => r.passed)
      result.failureReason = results.find((r) => !r.passed)?.message ?? null
      emit("assertions_evaluated", { testCaseId: tc.id, attempt, passed: assertionsPassed, results })
    }

    if (tc.goldenResponse) {
      const judge = await judgeSemanticSimilarity(
        tc.goldenResponse,
        agent.response,
        tc.triggerPrompt,
        suite.judgeModel ?? undefined,
        agent.trace.map((s) => `${s.tool}(${JSON.stringify(s.params)}) → ${s.result}`).join("\n")
      )
      result.semanticScore = judge.score
      result.judgeReasoning = judge.reasoning
      emit("semantic_scored", { testCaseId: tc.id, attempt, score: judge.score, reasoning: judge.reasoning, hallucinated: judge.hallucinated })
      if (!result.failureReason && judge.score < SEMANTIC_THRESHOLD) {
        result.failureReason = `Semantic score ${judge.score} below threshold (${SEMANTIC_THRESHOLD})${
          judge.hallucinated ? " — judge flagged possible hallucination" : ""
        }`
      }
    }

    result.passed = assertionsPassed && (result.semanticScore === null || result.semanticScore >= SEMANTIC_THRESHOLD)
    if (result.passed) result.failureReason = null
  } catch (err) {
    result.failureReason = err instanceof AgentRunnerError
      ? err.message
      : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
  }
  return result
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params
  const { stream, emit, close } = createSSEStream()
  const startedAt = Date.now()

  const finalizeFailed = () =>
    db.update(testRuns).set({ status: "failed", completedAt: new Date() }).where(eq(testRuns.id, runId)).catch(() => {})

  const execute = async () => {
    try {
      const [run] = await db.select().from(testRuns).where(eq(testRuns.id, runId))
      if (!run) { emit("error", { message: "Run not found" }); return }
      if (run.status !== "running") { emit("error", { message: "This run has already finished" }); return }

      const [suite] = await db.select().from(testSuites).where(eq(testSuites.id, run.suiteId))
      if (!suite) { emit("error", { message: "Suite not found" }); await finalizeFailed(); return }

      const cases = await db.select().from(testCases).where(eq(testCases.suiteId, run.suiteId)).orderBy(testCases.createdAt)
      if (cases.length === 0) { emit("error", { message: "No test cases in this suite" }); await finalizeFailed(); return }

      const agentUrl = run.agentUrl ?? suite.agentUrl
      const attempts = Math.min(5, Math.max(1, run.repeatCount))
      let passCount = 0, failCount = 0, flakyCount = 0

      for (const tc of cases) {
        emit("test_started", { testCaseId: tc.id, name: tc.name, attempts })

        const results: AttemptResult[] = []
        for (let attempt = 1; attempt <= attempts; attempt++) {
          if (Date.now() - startedAt > TIME_BUDGET_MS) break
          emit("attempt_started", { testCaseId: tc.id, attempt })
          const r = await runAttempt(tc, suite, agentUrl, attempt, emit)
          results.push(r)
          await db.insert(testResults).values({
            runId,
            testCaseId: tc.id,
            attempt,
            passed: r.passed,
            actualToolSequence: r.trace?.map((s) => s.tool) ?? null,
            tokenUsage: r.tokenUsage,
            stepCount: r.stepCount,
            rawResponse: r.rawResponse,
            semanticScore: r.semanticScore,
            judgeReasoning: r.judgeReasoning,
            failureReason: r.failureReason,
            assertionResults: r.assertionResults,
            trace: r.trace,
          })
          emit("attempt_completed", {
            testCaseId: tc.id, attempt, passed: r.passed, tokenUsage: r.tokenUsage, stepCount: r.stepCount,
            ...(r.failureReason ? { failureReason: r.failureReason } : {}),
          })
        }

        const passedAttempts = results.filter((r) => r.passed).length
        const skipped = results.length === 0
        const passed = !skipped && passedAttempts === results.length
        const flaky = passedAttempts > 0 && !passed
        if (passed) passCount++
        else failCount++
        if (flaky) flakyCount++

        const failureReason = skipped
          ? "Skipped — run reached its 5-minute time limit"
          : results.find((r) => !r.passed)?.failureReason ?? undefined
        emit("test_completed", {
          testCaseId: tc.id,
          passed,
          flaky,
          passedAttempts,
          attempts: results.length,
          tokenUsage: results.reduce((s, r) => s + r.tokenUsage, 0),
          stepCount: results.length ? Math.round(results.reduce((s, r) => s + r.stepCount, 0) / results.length) : 0,
          ...(failureReason && !passed ? { failureReason } : {}),
        })
      }

      const total = passCount + failCount
      await db.update(testRuns).set({
        status: "completed", passCount, failCount, flakyCount, completedAt: new Date(),
      }).where(eq(testRuns.id, runId))

      emit("run_completed", {
        passRate: total > 0 ? Math.round((passCount / total) * 100) : 0,
        totalPassed: passCount,
        totalFailed: failCount,
        totalFlaky: flakyCount,
      })
    } catch (err) {
      console.error("stream/[runId] execute error:", err)
      emit("error", { message: "Internal execution error" })
      await finalizeFailed()
    } finally {
      close()
    }
  }

  execute()

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
