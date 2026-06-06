import Link from "next/link"
import { FlaskConical, BarChart3, Play, TrendingUp, Plus, ArrowRight, CheckCircle2, XCircle } from "lucide-react"
import { db } from "@/lib/db"
import { testSuites, testCases, testRuns } from "@/lib/db/schema"
import { eq, sql, desc } from "drizzle-orm"
import { StatusBadge } from "@/components/status-badge"
import { PassRateBarChart, PassRateTrendChart } from "@/components/dashboard-charts"

async function getDashboardData() {
  const [suiteCount] = await db.select({ count: sql<number>`count(*)::int` }).from(testSuites)
  const [caseCount] = await db.select({ count: sql<number>`count(*)::int` }).from(testCases)
  const [runCount] = await db.select({ count: sql<number>`count(*)::int` }).from(testRuns)

  const recentRuns = await db
    .select({
      id: testRuns.id,
      status: testRuns.status,
      passCount: testRuns.passCount,
      failCount: testRuns.failCount,
      startedAt: testRuns.startedAt,
      completedAt: testRuns.completedAt,
      suiteName: testSuites.name,
      suiteId: testRuns.suiteId,
    })
    .from(testRuns)
    .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
    .orderBy(desc(testRuns.startedAt))
    .limit(10)

  const completedRuns = recentRuns.filter((r) => r.status === "completed")
  const avgPassRate =
    completedRuns.length > 0
      ? Math.round(
          completedRuns.reduce((sum, r) => {
            const total = (r.passCount ?? 0) + (r.failCount ?? 0)
            return sum + (total > 0 ? ((r.passCount ?? 0) / total) * 100 : 0)
          }, 0) / completedRuns.length
        )
      : 0

  const barData = completedRuns.slice(0, 8).reverse().map((r, i) => {
    const total = (r.passCount ?? 0) + (r.failCount ?? 0)
    return {
      label: `#${i + 1}`,
      passRate: total > 0 ? Math.round(((r.passCount ?? 0) / total) * 100) : 0,
      passed: r.passCount ?? 0,
      failed: r.failCount ?? 0,
    }
  })

  const trendData = completedRuns.slice(0, 10).reverse().map((r, i) => {
    const total = (r.passCount ?? 0) + (r.failCount ?? 0)
    return {
      label: `R${i + 1}`,
      passRate: total > 0 ? Math.round(((r.passCount ?? 0) / total) * 100) : 0,
    }
  })

  return {
    totalSuites: suiteCount?.count ?? 0,
    totalTestCases: caseCount?.count ?? 0,
    totalRuns: runCount?.count ?? 0,
    avgPassRate,
    recentRuns,
    barData,
    trendData,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const stats = [
    { label: "Test Suites", value: data.totalSuites, icon: FlaskConical, href: "/suites" },
    { label: "Test Cases", value: data.totalTestCases, icon: BarChart3, href: "/suites" },
    { label: "Total Runs", value: data.totalRuns, icon: Play, href: "/runs" },
    {
      label: "Avg Pass Rate",
      value: `${data.avgPassRate}%`,
      icon: TrendingUp,
      href: "/runs",
      accent: data.avgPassRate >= 80 ? "emerald" : data.avgPassRate >= 50 ? "amber" : "red",
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Overview of your agent testing activity</p>
        </div>
        <Link
          href="/suites/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Suite
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                <s.icon className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <div className={`text-2xl font-bold ${
              s.accent === "emerald" ? "text-emerald-500" :
              s.accent === "amber" ? "text-amber-500" :
              s.accent === "red" ? "text-red-500" :
              "text-foreground"
            }`}>
              {s.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">Pass Rate per Run</h2>
            <p className="text-[11px] text-muted-foreground">Last 8 completed runs</p>
          </div>
          <PassRateBarChart data={data.barData} />
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">Pass Rate Trend</h2>
            <p className="text-[11px] text-muted-foreground">Quality over time</p>
          </div>
          <PassRateTrendChart data={data.trendData} />
        </div>
      </div>

      {/* Recent runs table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Runs</h2>
          <Link href="/runs" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {data.recentRuns.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Play className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No runs yet. Create a suite and run your first test.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Suite</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pass Rate</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tests</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Started</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recentRuns.map((run) => {
                const total = (run.passCount ?? 0) + (run.failCount ?? 0)
                const passRate = total > 0 ? Math.round(((run.passCount ?? 0) / total) * 100) : 0
                return (
                  <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/suites/${run.suiteId}`} className="text-sm font-medium text-foreground hover:text-primary">
                        {run.suiteName ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={run.status as "passed" | "failed" | "running" | "completed"} />
                    </td>
                    <td className="px-4 py-2.5">
                      {total > 0 ? (
                        <span className={`text-sm font-semibold ${
                          passRate >= 80 ? "text-emerald-500" :
                          passRate >= 50 ? "text-amber-500" : "text-red-500"
                        }`}>
                          {passRate}%
                        </span>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5 text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" />{run.passCount ?? 0}
                        </span>
                        <span className="flex items-center gap-0.5 text-red-400">
                          <XCircle className="w-3 h-3" />{run.failCount ?? 0}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/runs/${run.id}`}
                        className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-0.5 justify-end"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
