export const dynamic = "force-dynamic"

import Link from "next/link"
import { History, CheckCircle2, XCircle, ArrowRight, AlertTriangle, GitCompareArrows } from "lucide-react"
import { db } from "@/lib/db"
import { testRuns, testSuites } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { StatusBadge } from "@/components/status-badge"
import { ReRunInlineButton } from "./rerun-inline-button"
import { DeleteRunButton } from "./delete-run-button"

async function getRuns() {
  return db
    .select({
      id: testRuns.id,
      suiteId: testRuns.suiteId,
      status: testRuns.status,
      passCount: testRuns.passCount,
      failCount: testRuns.failCount,
      flakyCount: testRuns.flakyCount,
      agentUrl: testRuns.agentUrl,
      startedAt: testRuns.startedAt,
      completedAt: testRuns.completedAt,
      suiteName: testSuites.name,
    })
    .from(testRuns)
    .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
    .orderBy(desc(testRuns.startedAt))
    .limit(50)
}

export default async function RunsPage() {
  const runs = await getRuns()

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Run History</h1>
            <p className="text-xs text-muted-foreground mt-0.5">All test suite executions and their results</p>
          </div>
          {runs.length >= 2 && (
            <Link
              href="/runs/compare"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-muted text-foreground text-sm font-medium rounded-md transition-colors"
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              Compare runs
            </Link>
          )}
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="bg-card border border-border rounded-lg px-6 py-14 text-center">
          <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-foreground mb-1.5">No runs yet</h2>
          <p className="text-xs text-muted-foreground">
            Run a test suite from the <Link href="/suites" className="text-primary hover:underline">Suites page</Link> to see results here.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Suite</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pass Rate</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tests</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Started</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Duration</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => {
                const total = (run.passCount ?? 0) + (run.failCount ?? 0)
                const passRate = total > 0 ? Math.round(((run.passCount ?? 0) / total) * 100) : null
                const duration = run.completedAt && run.startedAt
                  ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
                  : null

                return (
                  <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/suites/${run.suiteId}`} className="text-sm font-medium text-foreground hover:text-primary">
                        {run.suiteName ?? "—"}
                      </Link>
                      {run.agentUrl && <div className="text-[11px] font-mono text-muted-foreground/70 truncate max-w-[220px]">{run.agentUrl}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status as "passed" | "failed" | "running" | "completed"} />
                    </td>
                    <td className="px-4 py-2.5">
                      {passRate !== null ? (
                        <span className={`text-sm font-semibold ${
                          passRate >= 80 ? "text-emerald-500" :
                          passRate >= 50 ? "text-amber-500" : "text-red-500"
                        }`}>
                          {passRate}%
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5 text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" />{run.passCount ?? 0}
                        </span>
                        <span className="flex items-center gap-0.5 text-red-400">
                          <XCircle className="w-3 h-3" />{run.failCount ?? 0}
                        </span>
                        {run.flakyCount > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-500" title="Flaky: passed on some attempts only">
                            <AlertTriangle className="w-3 h-3" />{run.flakyCount}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {duration !== null ? `${duration}s` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/runs/${run.id}`}
                          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-0.5"
                        >
                          Report <ArrowRight className="w-3 h-3" />
                        </Link>
                        <ReRunInlineButton suiteId={run.suiteId} />
                        <DeleteRunButton runId={run.id} suiteName={run.suiteName ?? "suite"} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
