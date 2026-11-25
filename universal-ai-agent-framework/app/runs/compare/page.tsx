export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Minus, GitCompareArrows } from "lucide-react"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { testRuns, testSuites } from "@/lib/db/schema"
import { loadRun, type TestSummary } from "@/lib/run-summary"
import { cn } from "@/lib/utils"

type Status = TestSummary["status"]
type Change = "regressed" | "fixed" | "still-passing" | "still-failing" | "new" | "removed"

const RANK: Record<Status, number> = { failed: 0, flaky: 1, passed: 2 }

const CHANGE_META: Record<Change, { label: string; className: string; order: number }> = {
  regressed: { label: "Regressed", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30", order: 0 },
  fixed: { label: "Fixed", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", order: 1 },
  "still-failing": { label: "Still failing", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", order: 2 },
  new: { label: "New test", className: "bg-primary/10 text-primary border-primary/30", order: 3 },
  removed: { label: "Removed", className: "bg-muted text-muted-foreground border-border", order: 4 },
  "still-passing": { label: "Unchanged", className: "bg-muted text-muted-foreground border-border", order: 5 },
}

function classify(a?: TestSummary, b?: TestSummary): Change {
  if (!a) return "new"
  if (!b) return "removed"
  if (RANK[b.status] < RANK[a.status]) return "regressed"
  if (RANK[b.status] > RANK[a.status]) return "fixed"
  return b.status === "passed" ? "still-passing" : "still-failing"
}

async function recentRuns() {
  return db
    .select({
      id: testRuns.id,
      suiteName: testSuites.name,
      startedAt: testRuns.startedAt,
      passCount: testRuns.passCount,
      failCount: testRuns.failCount,
      agentUrl: testRuns.agentUrl,
    })
    .from(testRuns)
    .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
    .where(eq(testRuns.status, "completed"))
    .orderBy(desc(testRuns.startedAt))
    .limit(40)
}

function runLabel(r: Awaited<ReturnType<typeof recentRuns>>[number]) {
  const total = (r.passCount ?? 0) + (r.failCount ?? 0)
  const rate = total ? Math.round(((r.passCount ?? 0) / total) * 100) : 0
  const when = r.startedAt ? new Date(r.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""
  return `${r.suiteName ?? "Suite"} · ${when} · ${rate}% · ${r.agentUrl ?? ""}`
}

export default async function CompareRunsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams
  const baseId = typeof sp.base === "string" ? sp.base : undefined
  const headId = typeof sp.head === "string" ? sp.head : undefined
  const runs = await recentRuns()

  const picker = (
    <form className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-end gap-3">
      {[
        { name: "base", label: "Baseline (A)", value: baseId ?? runs[1]?.id },
        { name: "head", label: "Candidate (B)", value: headId ?? runs[0]?.id },
      ].map((f) => (
        <label key={f.name} className="flex-1 min-w-0">
          <span className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</span>
          <select
            name={f.name}
            defaultValue={f.value}
            className="w-full h-9 px-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {runs.map((r) => <option key={r.id} value={r.id}>{runLabel(r)}</option>)}
          </select>
        </label>
      ))}
      <button className="h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 justify-center">
        <GitCompareArrows className="w-4 h-4" />
        Compare
      </button>
    </form>
  )

  const header = (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Compare Runs</h1>
      <p className="text-xs text-muted-foreground mt-0.5">
        See exactly what changed between two runs: which tests regressed, which were fixed, and how scores, tokens and steps moved.
      </p>
    </div>
  )

  if (!baseId || !headId) {
    return (
      <div className="space-y-5">
        {header}
        {runs.length < 2 ? (
          <div className="bg-card border border-border rounded-lg px-6 py-10 text-center text-sm text-muted-foreground">
            You need at least two completed runs to compare. Run a suite, change the agent (or its URL), and run it again.
          </div>
        ) : picker}
      </div>
    )
  }

  const [a, b] = await Promise.all([loadRun(baseId), loadRun(headId)])
  if (!a || !b) notFound()

  const aMap = new Map(a.tests.map((t) => [t.testCaseId, t]))
  const bMap = new Map(b.tests.map((t) => [t.testCaseId, t]))
  const ids = [...new Set([...aMap.keys(), ...bMap.keys()])]
  const rows = ids
    .map((id) => {
      const ta = aMap.get(id), tb = bMap.get(id)
      return { id, a: ta, b: tb, change: classify(ta, tb), name: (tb ?? ta)!.name }
    })
    .sort((x, y) => CHANGE_META[x.change].order - CHANGE_META[y.change].order)

  const count = (c: Change) => rows.filter((r) => r.change === c).length
  const stats = (run: NonNullable<typeof a>) => {
    const total = run.tests.length
    const passed = run.tests.filter((t) => t.status === "passed").length
    const scores = run.tests.map((t) => t.avgSemantic).filter((s): s is number => s !== null)
    return {
      passRate: total ? Math.round((passed / total) * 100) : 0,
      semantic: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
      tokens: total ? Math.round(run.tests.reduce((s, t) => s + t.avgTokens, 0) / total) : 0,
      steps: total ? Math.round((run.tests.reduce((s, t) => s + t.avgSteps, 0) / total) * 10) / 10 : 0,
    }
  }
  const sa = stats(a), sb = stats(b)
  const agentChanged = (a.run.agentUrl ?? "") !== (b.run.agentUrl ?? "")
  const regressions = count("regressed"), fixes = count("fixed")

  return (
    <div className="space-y-5">
      <div>
        <Link href="/runs" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Run History
        </Link>
        {header}
      </div>

      {picker}

      <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        {[{ label: "Baseline (A)", r: a }, null, { label: "Candidate (B)", r: b }].map((side, i) =>
          side === null ? (
            <div key={i} className="hidden sm:flex items-center justify-center text-muted-foreground"><ArrowRight className="w-5 h-5" /></div>
          ) : (
            <Link key={i} href={`/runs/${side.r.run.id}`} className="bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition-colors min-w-0">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{side.label}</div>
              <div className="text-sm font-medium text-foreground mt-0.5">{side.r.run.suiteName}</div>
              <div className="text-xs text-muted-foreground">
                {side.r.run.startedAt ? new Date(side.r.run.startedAt).toLocaleString() : ""}
                {side.r.run.repeatCount > 1 ? ` · ${side.r.run.repeatCount} attempts/test` : ""}
              </div>
              <code className={cn("text-xs font-mono mt-1 block break-all", agentChanged ? "text-primary" : "text-muted-foreground/70")}>
                {side.r.run.agentUrl ?? "agent URL not recorded"}
              </code>
            </Link>
          )
        )}
      </div>

      <div className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        regressions > 0 ? "bg-red-500/5 border-red-500/30" : fixes > 0 ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/40 border-border"
      )}>
        <span className="font-semibold text-foreground">
          {regressions > 0
            ? `${regressions} test${regressions > 1 ? "s" : ""} regressed`
            : fixes > 0 ? "No regressions" : "No change in pass/fail status"}
        </span>
        {fixes > 0 && <span className="text-emerald-600 dark:text-emerald-400"> · {fixes} fixed</span>}
        {agentChanged && <span className="text-muted-foreground"> · the agent URL changed between these runs</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Delta label="Pass rate" a={sa.passRate} b={sb.passRate} unit="%" higherIsBetter />
        <Delta label="Avg semantic score" a={sa.semantic} b={sb.semantic} unit="" higherIsBetter />
        <Delta label="Avg tokens / test" a={sa.tokens} b={sb.tokens} unit="" higherIsBetter={false} />
        <Delta label="Avg steps / test" a={sa.steps} b={sb.steps} unit="" higherIsBetter={false} />
      </div>

      <div className="space-y-2">
        {rows.map((row) => <CompareRow key={row.id} {...row} />)}
      </div>
    </div>
  )
}

function Delta({ label, a, b, unit, higherIsBetter }: { label: string; a: number | null; b: number | null; unit: string; higherIsBetter: boolean }) {
  const diff = a !== null && b !== null ? Math.round((b - a) * 10) / 10 : null
  const good = diff !== null && diff !== 0 && (diff > 0) === higherIsBetter
  const bad = diff !== null && diff !== 0 && !good
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold text-foreground mt-0.5">
        {a ?? "—"}{a !== null ? unit : ""} <span className="text-muted-foreground font-normal text-sm">→</span> {b ?? "—"}{b !== null ? unit : ""}
      </div>
      <div className={cn("text-xs font-medium", good ? "text-emerald-500" : bad ? "text-red-500" : "text-muted-foreground")}>
        {diff === null ? "—" : diff === 0 ? "no change" : `${diff > 0 ? "+" : ""}${diff}${unit}`}
      </div>
    </div>
  )
}

function StatusIcon({ t }: { t?: TestSummary }) {
  if (!t) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />
  const label = t.attempts.length > 1 ? ` ${t.passedAttempts}/${t.attempts.length}` : ""
  return (
    <span className="flex items-center gap-1 text-xs font-medium">
      {t.status === "passed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
      {t.status === "failed" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
      {t.status === "flaky" && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

function CompareRow({ name, a, b, change }: { name: string; a?: TestSummary; b?: TestSummary; change: Change }) {
  const meta = CHANGE_META[change]
  const toolsA = a?.attempts[0]?.actualToolSequence?.join(" → ") || "no tool calls"
  const toolsB = b?.attempts[0]?.actualToolSequence?.join(" → ") || "no tool calls"
  const bFailure = b?.attempts.find((x) => !x.passed)?.failureReason

  return (
    <details className="group bg-card border border-border rounded-lg overflow-hidden" open={change === "regressed"}>
      <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer list-none hover:bg-muted/30 select-none">
        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 w-24 text-center", meta.className)}>{meta.label}</span>
        <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{name}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <StatusIcon t={a} />
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <StatusIcon t={b} />
        </span>
        <span className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 w-44 justify-end">
          {a && b && <span>{a.avgTokens.toLocaleString()} → {b.avgTokens.toLocaleString()} tok</span>}
          {a?.avgSemantic != null && b?.avgSemantic != null && <span>{a.avgSemantic} → {b.avgSemantic}</span>}
        </span>
      </summary>
      <div className="border-t border-border px-4 py-3 space-y-3 text-xs">
        {bFailure && (
          <div className="text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">B: {bFailure}</div>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          {[{ label: "A", t: a, tools: toolsA }, { label: "B", t: b, tools: toolsB }].map(({ label, t, tools }) => (
            <div key={label} className="space-y-1.5 min-w-0">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label === "A" ? "Baseline (A)" : "Candidate (B)"}</div>
              {t ? (
                <>
                  <div className={cn("font-mono break-words", toolsA !== toolsB ? "text-primary" : "text-muted-foreground")}>{tools}</div>
                  <div className="text-muted-foreground">{t.avgSteps} steps · {t.avgTokens.toLocaleString()} tokens{t.avgSemantic !== null ? ` · ${t.avgSemantic}/100` : ""}</div>
                  <div className="bg-muted/40 border border-border rounded-md p-2.5 text-foreground leading-relaxed whitespace-pre-wrap">
                    {t.attempts[0]?.rawResponse || <span className="italic text-muted-foreground">No response</span>}
                  </div>
                </>
              ) : (
                <div className="italic text-muted-foreground">Not part of this run</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
