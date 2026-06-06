import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { testRuns, testCases, testResults, testSuites } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runTestCase, AgentRunnerError } from "@/lib/agent-runner"
import { runAssertions } from "@/lib/assertions"
import { judgeSemanticSimilarity } from "@/lib/groq-judge"
import { createSSEStream } from "@/lib/sse"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params
  const { stream, emit, close } = createSSEStream()

  const execute = async () => {
    try {
      const [run] = await db
        .select()
        .from(testRuns)
        .where(eq(testRuns.id, runId))

      if (!run) {
        emit("error", { message: "Run not found" })
        close()
        return
      }

      const [suite] = await db
        .select()
        .from(testSuites)
        .where(eq(testSuites.id, run.suiteId))

      if (!suite) {
        emit("error", { message: "Suite not found" })
        close()
        return
      }

      const cases = await db
        .select()
        .from(testCases)
        .where(eq(testCases.suiteId, run.suiteId))
        .orderBy(testCases.createdAt)

      if (cases.length === 0) {
        emit("error", { message: "No test cases in this suite" })
        await db.update(testRuns).set({ status: "failed", completedAt: new Date() }).where(eq(testRuns.id, runId))
        close()
        return
      }

      let passCount = 0
      let failCount = 0

      for (const tc of cases) {
        emit("test_started", { testCaseId: tc.id, name: tc.name })

        let passed = false
        let failureReason: string | undefined
        let traceData = null
        let tokenUsage = 0
        let stepCount = 0
        let rawResponse = ""
        let semanticScore: number | null = null
        let judgeReasoning: string | null = null
        let assertionResultsData = null

        try {
          const agentResult = await runTestCase(suite.agentUrl, suite.agentAuthKey, tc.triggerPrompt)

          traceData = agentResult.trace
          tokenUsage = agentResult.tokenUsage
          stepCount = agentResult.stepCount
          rawResponse = agentResult.response

          emit("trace_captured", { testCaseId: tc.id, trace: traceData, stepCount })

          const assertions = tc.assertions ?? []
          let assertionsPassed = true

          if (assertions.length > 0) {
            const results = runAssertions(assertions, {
              trace: traceData,
              response: rawResponse,
              stepCount,
            })
            assertionResultsData = results
            assertionsPassed = results.every((r) => r.passed)
            const failedAssertion = results.find((r) => !r.passed)
            if (failedAssertion) failureReason = failedAssertion.message

            emit("assertions_evaluated", {
              testCaseId: tc.id,
              passed: assertionsPassed,
              results,
            })
          }

          if (tc.goldenResponse) {
            const judgeResult = await judgeSemanticSimilarity(
              tc.goldenResponse,
              rawResponse,
              tc.triggerPrompt,
              suite.judgeModel ?? undefined
            )
            semanticScore = judgeResult.score
            judgeReasoning = judgeResult.reasoning

            emit("semantic_scored", {
              testCaseId: tc.id,
              score: judgeResult.score,
              reasoning: judgeResult.reasoning,
              hallucinated: judgeResult.hallucinated,
            })

            if (judgeResult.hallucinated && !failureReason) {
              failureReason = "Response contains hallucinated content"
            }
          }

          passed = assertionsPassed && (semanticScore === null || semanticScore >= 50)
          if (!passed && !failureReason) failureReason = "Semantic score below threshold (50)"
        } catch (err) {
          failureReason = err instanceof AgentRunnerError
            ? err.message
            : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
          passed = false
        }

        await db.insert(testResults).values({
          runId,
          testCaseId: tc.id,
          passed,
          actualToolSequence: traceData?.map((s) => s.tool) ?? null,
          tokenUsage,
          stepCount,
          rawResponse,
          semanticScore,
          judgeReasoning,
          failureReason: failureReason ?? null,
          assertionResults: assertionResultsData,
          trace: traceData,
        })

        if (passed) { passCount++ } else { failCount++ }

        emit("test_completed", {
          testCaseId: tc.id,
          passed,
          tokenUsage,
          stepCount,
          ...(failureReason ? { failureReason } : {}),
        })
      }

      const total = passCount + failCount
      const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0

      await db.update(testRuns).set({
        status: "completed",
        passCount,
        failCount,
        completedAt: new Date(),
      }).where(eq(testRuns.id, runId))

      emit("run_completed", { passRate, totalPassed: passCount, totalFailed: failCount })
    } catch (err) {
      console.error("stream/[runId] execute error:", err)
      emit("error", { message: "Internal execution error" })
      await db.update(testRuns).set({ status: "failed", completedAt: new Date() }).where(eq(testRuns.id, runId)).catch(() => {})
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
