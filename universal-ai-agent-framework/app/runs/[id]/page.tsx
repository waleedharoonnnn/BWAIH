import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react"
import { db } from "@/lib/db"
import { testRuns, testResults, testCases, testSuites } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { StatusBadge } from "@/components/status-badge"
import { SemanticScoreRing } from "@/components/semantic-score-ring"
import { TraceTimeline } from "@/components/trace-timeline"
import { ToolSequenceDiff } from "@/components/tool-sequence-diff"
import { ReRunButton } from "./rerun-button"

async function getRunReport(id: string) {
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
    })
    .from(testRuns)
    .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
    .where(eq(testRuns.id, id))

  if (!run) return null

  const results = await db
    .select({
      id: testResults.id,
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
      triggerPrompt: testCases.triggerPrompt,
    })
    .from(testResults)
    .leftJoin(testCases, eq(testResults.testCaseId, testCases.id))
    .where(eq(testResults.runId, id))

  return { run, results }
}

export default async function RunReportPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const data = await getRunReport(id)
  if (!data) notFound()

  const { run, results } = data
  const total = (run.passCount ?? 0) + (run.failCount ?? 0)
  const passRate = total > 0 ? Math.round(((run.passCount ?? 0) / total) * 100) : 0
  const scoredResults = results.filter((r) => r.semanticScore !== null)
  const avgSemantic = scoredResults.length > 0
    ? Math.round(scoredResults.reduce((s, r) => s + (r.semanticScore ?? 0), 0) / scoredResults.length)
    : null
  const duration = run.completedAt && run.startedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null

  return (
    <div className="space-y-5">
      <div>
        <Link href="/runs" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Run History
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-xl font-semibold text-foreground">{run.suiteName ?? "Run Report"}</h1>
              <StatusBadge status={run.status as "passed" | "failed" | "running" | "completed"} />
            </div>
            <p className="text-xs text-muted-foreground">
              {run.startedAt ? new Date(run.startedAt).toLocaleString() : ""}
              {duration !== null ? ` · ${duration}s` : ""}
            </p>
          </div>
          <ReRunButton suiteId={run.suiteId} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total Tests", value: total, color: "" },
          { label: "Passed", value: run.passCount ?? 0, color: "text-emerald-500" },
          { label: "Failed", value: run.failCount ?? 0, color: "text-red-500" },
          { label: "Pass Rate", value: `${passRate}%`, color: passRate >= 80 ? "text-emerald-500" : passRate >= 50 ? "text-amber-500" : "text-red-500" },
          { label: "Avg Semantic", value: avgSemantic !== null ? `${avgSemantic}/100` : "—", color: "" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3 text-center">
            <div className={`text-xl font-bold ${s.color || "text-foreground"}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-2">
        {results.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  )
}

function ResultCard({ result }: {
  result: {
    id: string
    passed: boolean | null
    actualToolSequence: string[] | null
    tokenUsage: number | null
    stepCount: number | null
    rawResponse: string | null
    semanticScore: number | null
    judgeReasoning: string | null
    failureReason: string | null
    assertionResults: Array<{ assertion: { type: string; value: string | number | string[]; description: string }; passed: boolean; actual: string | number | null; message: string }> | null
    trace: Array<{ step: number; tool: string; params: Record<string, unknown>; result: string; timestamp: number }> | null
    testCaseName: string | null
    expectedToolSequence: string[] | null
    goldenResponse: string | null
    triggerPrompt: string | null
  }
}) {
  return (
    <details className="group bg-card border border-border rounded-lg overflow-hidden">
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none hover:bg-muted/30 select-none transition-colors">
        <span className="flex-shrink-0">
          {result.passed
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <XCircle className="w-4 h-4 text-red-500" />
          }
        </span>
        <span className="text-sm font-medium text-foreground flex-1">{result.testCaseName ?? "Unknown"}</span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{result.stepCount ?? 0} steps</span>
          <span>{result.tokenUsage ?? 0} tokens</span>
          {result.semanticScore !== null && (
            <span className={
              result.semanticScore >= 80 ? "text-emerald-500 font-semibold" :
              result.semanticScore >= 50 ? "text-amber-500 font-semibold" :
              "text-red-500 font-semibold"
            }>
              {result.semanticScore}/100 sem
            </span>
          )}
        </div>
        {result.failureReason && (
          <span className="text-xs text-destructive max-w-[200px] truncate">{result.failureReason}</span>
        )}
        <span className="text-xs text-muted-foreground/40 group-open:rotate-180 transition-transform">▼</span>
      </summary>

      <div className="border-t border-border px-4 py-4 space-y-5">
        {/* Tool diff */}
        {(result.expectedToolSequence?.length || result.actualToolSequence?.length) && (
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Tool Sequence</h3>
            <ToolSequenceDiff
              expected={result.expectedToolSequence ?? []}
              actual={result.actualToolSequence ?? []}
            />
          </div>
        )}

        {/* Assertions */}
        {result.assertionResults && result.assertionResults.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Assertions</h3>
            <div className="space-y-1.5">
              {result.assertionResults.map((ar, i) => (
                <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-md text-xs border ${
                  ar.passed
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-destructive/5 border-destructive/20"
                }`}>
                  <span className={ar.passed ? "text-emerald-500" : "text-destructive"}>
                    {ar.passed ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <span className={ar.passed ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{ar.message}</span>
                    {ar.actual !== null && (
                      <span className="text-muted-foreground ml-2">actual: {String(ar.actual)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Semantic score — always show when golden response exists */}
        {result.goldenResponse ? (
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Semantic Analysis</h3>
            {result.semanticScore !== null ? (
              <div className="flex items-start gap-4 mb-3">
                <SemanticScoreRing score={result.semanticScore} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground mb-0.5">Score: {result.semanticScore}/100</div>
                  {result.judgeReasoning && (
                    <p className="text-xs text-muted-foreground italic">{result.judgeReasoning}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-muted/40 border border-border">
                <span className="text-xs text-muted-foreground italic">Semantic scoring was not run for this result.</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Golden Response</div>
                <div className="text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-md p-2.5 text-foreground leading-relaxed whitespace-pre-wrap">
                  {result.goldenResponse}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Actual Response</div>
                <div className="text-xs bg-muted/40 border border-border rounded-md p-2.5 text-foreground leading-relaxed whitespace-pre-wrap">
                  {result.rawResponse ?? <span className="italic text-muted-foreground">No response captured</span>}
                </div>
              </div>
            </div>
          </div>
        ) : result.rawResponse ? (
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Agent Response</h3>
            <div className="text-xs bg-muted/40 border border-border rounded-md p-2.5 text-foreground leading-relaxed whitespace-pre-wrap">
              {result.rawResponse}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 italic">No golden response set — semantic scoring skipped.</p>
          </div>
        ) : null}

        {/* Trace */}
        {result.trace && result.trace.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Execution Trace</h3>
            <TraceTimeline trace={result.trace} />
          </div>
        )}
      </div>
    </details>
  )
}
