import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { testRuns, testResults, testCases, testSuites } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

async function getRunProfile(runId: string) {
  const [run] = await db
    .select({
      id: testRuns.id,
      suiteId: testRuns.suiteId,
      status: testRuns.status,
      passCount: testRuns.passCount,
      failCount: testRuns.failCount,
      startedAt: testRuns.startedAt,
      completedAt: testRuns.completedAt,
      suiteName: testSuites.name,
      agentUrl: testSuites.agentUrl,
      judgeModel: testSuites.judgeModel,
    })
    .from(testRuns)
    .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
    .where(eq(testRuns.id, runId))

  if (!run) return null

  const results = await db
    .select({
      testCaseId: testResults.testCaseId,
      passed: testResults.passed,
      tokenUsage: testResults.tokenUsage,
      stepCount: testResults.stepCount,
      semanticScore: testResults.semanticScore,
      failureReason: testResults.failureReason,
      testCaseName: testCases.name,
    })
    .from(testResults)
    .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
    .where(eq(testResults.runId, runId))

  const total = results.length
  const passCount = results.filter((r) => r.passed).length
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0

  const scoredResults = results.filter((r) => r.semanticScore !== null)
  const avgSemanticScore =
    scoredResults.length > 0
      ? Math.round(scoredResults.reduce((s, r) => s + (r.semanticScore ?? 0), 0) / scoredResults.length)
      : 0

  const avgTokenUsage =
    total > 0 ? Math.round(results.reduce((s, r) => s + (r.tokenUsage ?? 0), 0) / total) : 0

  const avgStepCount =
    total > 0 ? Math.round(results.reduce((s, r) => s + (r.stepCount ?? 0), 0) / total) : 0

  return {
    runId: run.id,
    suiteName: run.suiteName ?? "Unknown Suite",
    agentUrl: run.agentUrl ?? "",
    judgeModel: run.judgeModel ?? null,
    status: run.status,
    completedAt: run.completedAt?.toISOString() ?? null,
    startedAt: run.startedAt?.toISOString() ?? "",
    totalTests: total,
    passCount,
    failCount: total - passCount,
    passRate,
    avgSemanticScore,
    avgTokenUsage,
    avgStepCount,
    results: results.map((r) => ({
      testCaseId: r.testCaseId,
      testCaseName: r.testCaseName ?? "Unknown",
      passed: r.passed ?? false,
      semanticScore: r.semanticScore ?? null,
      tokenUsage: r.tokenUsage ?? 0,
      stepCount: r.stepCount ?? 0,
      failureReason: r.failureReason ?? null,
    })),
  }
}

export type RunProfile = NonNullable<Awaited<ReturnType<typeof getRunProfile>>>

export type BenchmarkDimension = {
  scoreA: number
  scoreB: number
  winner: "a" | "b" | "tie"
}

export type ComparisonResult = {
  runA: RunProfile
  runB: RunProfile
  benchmark: {
    accuracy: BenchmarkDimension
    semanticQuality: BenchmarkDimension
    efficiency: BenchmarkDimension
    speed: BenchmarkDimension
    overall: BenchmarkDimension
  }
  matchedTests: Array<{
    testCaseId: string
    testCaseName: string
    a: { passed: boolean; semanticScore: number | null; tokenUsage: number; stepCount: number } | null
    b: { passed: boolean; semanticScore: number | null; tokenUsage: number; stepCount: number } | null
  }>
}

function dim(a: number, b: number): BenchmarkDimension {
  const diff = a - b
  const winner: "a" | "b" | "tie" = diff > 2 ? "a" : diff < -2 ? "b" : "tie"
  return { scoreA: Math.round(a), scoreB: Math.round(b), winner }
}

function effScore(avgTokens: number) {
  // 0 tokens = 100, 1000 tokens ≈ 33, 1500+ tokens = 0
  return Math.max(0, Math.min(100, 100 - avgTokens / 15))
}

function speedScore(avgSteps: number) {
  // 0 steps = 100, 5 steps = 60, 12+ steps = 0
  return Math.max(0, Math.min(100, 100 - avgSteps * 8))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const runAId = searchParams.get("runA")
  const runBId = searchParams.get("runB")

  if (!runAId || !runBId) {
    return Response.json({ error: "runA and runB query params are required" }, { status: 400 })
  }
  if (runAId === runBId) {
    return Response.json({ error: "Cannot compare a run with itself" }, { status: 400 })
  }

  try {
    const [runA, runB] = await Promise.all([getRunProfile(runAId), getRunProfile(runBId)])

    if (!runA) return Response.json({ error: "Run A not found" }, { status: 404 })
    if (!runB) return Response.json({ error: "Run B not found" }, { status: 404 })

    const effA = effScore(runA.avgTokenUsage)
    const effB = effScore(runB.avgTokenUsage)
    const spdA = speedScore(runA.avgStepCount)
    const spdB = speedScore(runB.avgStepCount)

    const overallA = 0.35 * runA.passRate + 0.35 * runA.avgSemanticScore + 0.15 * effA + 0.15 * spdA
    const overallB = 0.35 * runB.passRate + 0.35 * runB.avgSemanticScore + 0.15 * effB + 0.15 * spdB

    const benchmark: ComparisonResult["benchmark"] = {
      accuracy: dim(runA.passRate, runB.passRate),
      semanticQuality: dim(runA.avgSemanticScore, runB.avgSemanticScore),
      efficiency: dim(effA, effB),
      speed: dim(spdA, spdB),
      overall: dim(overallA, overallB),
    }

    const mapA = new Map(runA.results.map((r) => [r.testCaseId, r]))
    const mapB = new Map(runB.results.map((r) => [r.testCaseId, r]))
    const allIds = new Set([...mapA.keys(), ...mapB.keys()])

    const matchedTests: ComparisonResult["matchedTests"] = Array.from(allIds).map((id) => {
      const ra = mapA.get(id)
      const rb = mapB.get(id)
      return {
        testCaseId: id,
        testCaseName: ra?.testCaseName ?? rb?.testCaseName ?? "Unknown",
        a: ra ? { passed: ra.passed, semanticScore: ra.semanticScore, tokenUsage: ra.tokenUsage, stepCount: ra.stepCount } : null,
        b: rb ? { passed: rb.passed, semanticScore: rb.semanticScore, tokenUsage: rb.tokenUsage, stepCount: rb.stepCount } : null,
      }
    })

    return Response.json({ runA, runB, benchmark, matchedTests } satisfies ComparisonResult)
  } catch (err) {
    console.error("GET /api/compare:", err)
    return Response.json({ error: "Comparison failed" }, { status: 500 })
  }
}
