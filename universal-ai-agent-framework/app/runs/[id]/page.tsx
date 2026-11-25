import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, GitCompareArrows } from "lucide-react"
import { db } from "@/lib/db"
import { testRuns } from "@/lib/db/schema"
import { and, desc, eq, lt } from "drizzle-orm"
import { StatusBadge } from "@/components/status-badge"
import { SemanticScoreRing } from "@/components/semantic-score-ring"
import { TraceTimeline } from "@/components/trace-timeline"
import { ToolSequenceDiff } from "@/components/tool-sequence-diff"
import { loadRun, type AttemptRow, type TestSummary } from "@/lib/run-summary"
import { ReRunButton } from "./rerun-button"

async function getRunReport(id: string) {
  const loaded = await loadRun(id)
  if (!loaded) return null
  const { run } = loaded

  const [previous] = run.startedAt
    ? await db
        .select({ id: testRuns.id })
        .from(testRuns)
        .where(and(eq(testRuns.suiteId, run.suiteId), eq(testRuns.status, "completed"), lt(testRuns.startedAt, run.startedAt)))
        .orderBy(desc(testRuns.startedAt))
        .limit(1)
    : []

  return { ...loaded, previousRunId: previous?.id ?? null }
}

export default async function RunReportPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const data = await getRunReport(id)
  if (!data) notFound()

  const { run, tests, previousRunId } = data
  const total = (run.passCount ?? 0) + (run.failCount ?? 0)
  const passRate = total > 0 ? Math.round(((run.passCount ?? 0) / total) * 100) : 0
  const scores = tests.flatMap((t) => t.attempts.map((a) => a.semanticScore).filter((s): s is number => s !== null))
  const avgSemantic = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const totalTokens = tests.reduce((s, t) => s + t.attempts.reduce((x, a) => x + (a.tokenUsage ?? 0), 0), 0)
  const duration = run.completedAt && run.startedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null
  const repeated = run.repeatCount > 1

  return (
    <div className="space-y-5">
      <div>
        <Link href="/runs" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Run History
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-xl font-semibold text-foreground">{run.suiteName ?? "Run Report"}</h1>
              <StatusBadge status={run.status as "passed" | "failed" | "running" | "completed"} />
            </div>
            <p className="text-xs text-muted-foreground">
              {run.startedAt ? new Date(run.startedAt).toLocaleString() : ""}
              {duration !== null ? ` · ${duration}s` : ""}
              {repeated ? ` · ${run.repeatCount} attempts per test` : ""}
            </p>
            {run.agentUrl && <code className="text-xs text-muted-foreground/70 font-mono mt-1 block break-all">{run.agentUrl}</code>}
          </div>
          <div className="flex items-center gap-2">
            {previousRunId && (
              <Link
                href={`/runs/compare?base=${previousRunId}&head=${run.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-muted text-foreground text-sm font-medium rounded-md transition-colors"
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
                Compare with previous
              </Link>
            )}
            <ReRunButton suiteId={run.suiteId} />
          </div>
        </div>
      </div>

      <div className={`grid gap-3 grid-cols-3 ${repeated ? "sm:grid-cols-7" : "sm:grid-cols-6"}`}>
        {[
          { label: "Total Tests", value: total, color: "" },
          { label: "Passed", value: run.passCount ?? 0, color: "text-emerald-500" },
          { label: "Failed", value: run.failCount ?? 0, color: "text-red-500" },
          ...(repeated ? [{ label: "Flaky", value: run.flakyCount, color: "text-amber-500" }] : []),
          { label: "Pass Rate", value: `${passRate}%`, color: passRate >= 80 ? "text-emerald-500" : passRate >= 50 ? "text-amber-500" : "text-red-500" },
          { label: "Avg Semantic", value: avgSemantic !== null ? `${avgSemantic}/100` : "—", color: "" },
          { label: "Total Tokens", value: totalTokens.toLocaleString(), color: "" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-3 text-center">
            <div className={`text-xl font-bold ${s.color || "text-foreground"}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {tests.map((t) => <TestCard key={t.testCaseId} test={t} />)}
        {tests.length === 0 && (
          <div className="bg-card border border-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
            No results recorded for this run.
          </div>
        )}
      </div>
    </div>
  )
}

function range(values: number[], unit: string) {
  if (values.length === 0) return null
  const min = Math.min(...values), max = Math.max(...values)
  return min === max ? `${min.toLocaleString()} ${unit}` : `${min.toLocaleString()}–${max.toLocaleString()} ${unit}`
}

function TestCard({ test }: { test: TestSummary }) {
  const n = test.attempts.length
  const firstFailure = test.attempts.find((a) => !a.passed)
  const tokens = range(test.attempts.map((a) => a.tokenUsage ?? 0), "tokens")
  const steps = range(test.attempts.map((a) => a.stepCount ?? 0), "steps")

  return (
    <details className="group bg-card border border-border rounded-lg overflow-hidden">
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none hover:bg-muted/30 select-none transition-colors">
        <span className="flex-shrink-0">
          {test.status === "passed" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {test.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
          {test.status === "flaky" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        </span>
        <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{test.name}</span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
          {n > 1 && (
            <span className={test.status === "flaky" ? "text-amber-500 font-semibold" : test.status === "failed" ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>
              {test.passedAttempts}/{n} passed{test.status === "flaky" ? " · flaky" : ""}
            </span>
          )}
          <span className="hidden sm:inline">{steps}</span>
          <span className="hidden sm:inline">{tokens}</span>
          {test.avgSemantic !== null && (
            <span className={test.avgSemantic >= 80 ? "text-emerald-500 font-semibold" : test.avgSemantic >= 50 ? "text-amber-500 font-semibold" : "text-red-500 font-semibold"}>
              {test.avgSemantic}/100
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground/40 group-open:rotate-180 transition-transform">▼</span>
      </summary>

      <div className="border-t border-border px-4 py-4 space-y-4">
        {firstFailure?.failureReason && (
          <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
            {n > 1 ? `Attempt ${firstFailure.attempt}: ` : ""}{firstFailure.failureReason}
          </div>
        )}
        {n === 1 ? (
          <AttemptDetail attempt={test.attempts[0]} test={test} />
        ) : (
          test.attempts.map((a) => (
            <details key={a.attempt} className="group/att border border-border rounded-md overflow-hidden" open={a === firstFailure}>
              <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer list-none hover:bg-muted/30 text-xs select-none">
                {a.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                <span className="font-medium text-foreground">Attempt {a.attempt}</span>
                <span className="text-muted-foreground font-mono truncate flex-1 min-w-0">{a.actualToolSequence?.join(" → ") || "no tool calls"}</span>
                <span className="text-muted-foreground">{a.stepCount ?? 0} steps · {(a.tokenUsage ?? 0).toLocaleString()} tokens</span>
                {a.semanticScore !== null && <span className="text-muted-foreground">{a.semanticScore}/100</span>}
              </summary>
              <div className="border-t border-border px-3 py-3">
                <AttemptDetail attempt={a} test={test} />
              </div>
            </details>
          ))
        )}
      </div>
    </details>
  )
}

function AttemptDetail({ attempt: a, test }: { attempt: AttemptRow; test: TestSummary }) {
  return (
    <div className="space-y-5">
      {test.expectedToolSequence?.length || a.actualToolSequence?.length ? (
        <div>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Tool Sequence</h3>
          <ToolSequenceDiff expected={test.expectedToolSequence ?? []} actual={a.actualToolSequence ?? []} />
        </div>
      ) : null}

      {a.assertionResults && a.assertionResults.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Assertions</h3>
          <div className="space-y-1.5">
            {a.assertionResults.map((ar, i) => (
              <div key={i} className={`flex items-start gap-3 px-3 py-2 rounded-md text-xs border ${
                ar.passed ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20"
              }`}>
                <span className={ar.passed ? "text-emerald-500" : "text-destructive"}>{ar.passed ? "✓" : "✗"}</span>
                <div className="flex-1 min-w-0">
                  <span className={ar.passed ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{ar.message}</span>
                  {ar.assertion.description && <span className="text-muted-foreground ml-2">({ar.assertion.description})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {test.goldenResponse ? (
        <div>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Semantic Analysis</h3>
          {a.semanticScore !== null ? (
            <div className="flex items-start gap-4 mb-3">
              <SemanticScoreRing score={a.semanticScore} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground mb-0.5">Score: {a.semanticScore}/100</div>
                {a.judgeReasoning && <p className="text-xs text-muted-foreground italic">{a.judgeReasoning}</p>}
              </div>
            </div>
          ) : (
            <div className="mb-3 px-3 py-2 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground italic">
              Semantic scoring did not run for this attempt (the agent call failed).
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Golden Response</div>
              <div className="text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-md p-2.5 text-foreground leading-relaxed whitespace-pre-wrap">
                {test.goldenResponse}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Actual Response</div>
              <div className="text-xs bg-muted/40 border border-border rounded-md p-2.5 text-foreground leading-relaxed whitespace-pre-wrap">
                {a.rawResponse || <span className="italic text-muted-foreground">No response captured</span>}
              </div>
            </div>
          </div>
        </div>
      ) : a.rawResponse ? (
        <div>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Agent Response</h3>
          <div className="text-xs bg-muted/40 border border-border rounded-md p-2.5 text-foreground leading-relaxed whitespace-pre-wrap">
            {a.rawResponse}
          </div>
        </div>
      ) : null}

      {a.trace && a.trace.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Execution Trace</h3>
          <TraceTimeline trace={a.trace} />
        </div>
      )}
    </div>
  )
}
