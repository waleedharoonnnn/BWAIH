import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { testRuns, testResults, testCases, testSuites } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const [run] = await db
      .select({
        id: testRuns.id,
        suiteId: testRuns.suiteId,
        status: testRuns.status,
        passCount: testRuns.passCount,
        failCount: testRuns.failCount,
        flakyCount: testRuns.flakyCount,
        agentUrl: testRuns.agentUrl,
        repeatCount: testRuns.repeatCount,
        startedAt: testRuns.startedAt,
        completedAt: testRuns.completedAt,
        suiteName: testSuites.name,
      })
      .from(testRuns)
      .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
      .where(eq(testRuns.id, id))

    if (!run) return Response.json({ error: "Run not found" }, { status: 404 })

    const results = await db
      .select({
        id: testResults.id,
        runId: testResults.runId,
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
        createdAt: testResults.createdAt,
        testCaseName: testCases.name,
        triggerPrompt: testCases.triggerPrompt,
        expectedToolSequence: testCases.expectedToolSequence,
        goldenResponse: testCases.goldenResponse,
      })
      .from(testResults)
      .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
      .where(eq(testResults.runId, id))

    return Response.json({ run, results })
  } catch (err) {
    console.error("GET /api/runs/[id]:", err)
    return Response.json({ error: "Failed to fetch run" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const [deleted] = await db.delete(testRuns).where(eq(testRuns.id, id)).returning({ id: testRuns.id })
    if (!deleted) return Response.json({ error: "Run not found" }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/runs/[id]:", err)
    return Response.json({ error: "Failed to delete run" }, { status: 500 })
  }
}
