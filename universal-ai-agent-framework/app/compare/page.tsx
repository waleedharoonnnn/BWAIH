"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeftRight, Trophy, ChevronRight, Loader2,
  CheckCircle2, XCircle, Minus, Cpu, Zap, Target, Brain, TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ComparisonResult, BenchmarkDimension } from "@/app/api/compare/route"

type RunOption = {
  id: string
  suiteName: string
  status: string
  startedAt: string
  passCount: number
  failCount: number
  totalTests: number
}

const BENCHMARK_DIMS: Array<{
  key: keyof ComparisonResult["benchmark"]
  label: string
  icon: React.ElementType
  description: string
}> = [
  { key: "accuracy", label: "Accuracy", icon: Target, description: "Pass rate across all test cases" },
  { key: "semanticQuality", label: "Semantic Quality", icon: Brain, description: "Avg LLM-judged similarity to golden responses" },
  { key: "efficiency", label: "Token Efficiency", icon: Cpu, description: "Lower token usage = higher score" },
  { key: "speed", label: "Step Speed", icon: Zap, description: "Fewer reasoning steps = higher score" },
  { key: "overall", label: "Overall Score", icon: TrendingUp, description: "35% accuracy + 35% semantic + 15% efficiency + 15% speed" },
]

function WinnerBadge({ winner, side }: { winner: "a" | "b" | "tie"; side: "a" | "b" }) {
  if (winner === "tie") return <span className="text-xs text-muted-foreground font-medium">TIE</span>
  if (winner === side) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-500">
      <Trophy className="w-3 h-3" /> WIN
    </span>
  )
  return <span className="text-xs text-muted-foreground/40">—</span>
}

function ScoreBar({ score, active }: { score: number; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", active ? "bg-primary" : "bg-muted-foreground/30")}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("text-sm font-bold w-8 text-right tabular-nums", active ? "text-foreground" : "text-muted-foreground")}>
        {score}
      </span>
    </div>
  )
}

function BenchmarkRow({ dim, data }: { dim: typeof BENCHMARK_DIMS[number]; data: BenchmarkDimension }) {
  const Icon = dim.icon
  return (
    <div className="grid grid-cols-[44px_1fr_36px_1fr_44px] gap-2 items-center py-2.5 border-b border-border last:border-0">
      <div className="text-right"><WinnerBadge winner={data.winner} side="a" /></div>
      <ScoreBar score={data.scoreA} active={data.winner !== "b"} />
      <div className="flex flex-col items-center gap-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <ScoreBar score={data.scoreB} active={data.winner !== "a"} />
      <div><WinnerBadge winner={data.winner} side="b" /></div>
    </div>
  )
}

function AgentCard({
  profile, label, color, overallScore, isWinner,
}: {
  profile: ComparisonResult["runA"]
  label: string
  color: "blue" | "violet"
  overallScore: number
  isWinner: boolean
}) {
  const accent = color === "blue"
    ? "border-blue-500/40 ring-blue-500/30"
    : "border-violet-500/40 ring-violet-500/30"
  const textAccent = color === "blue" ? "text-blue-500" : "text-violet-500"
  const bgAccent = color === "blue" ? "bg-blue-500/10" : "bg-violet-500/10"
  const badgeBg = color === "blue" ? "bg-blue-500" : "bg-violet-500"

  return (
    <div className={cn("flex-1 bg-card rounded-lg border p-4 relative", isWinner ? `ring-2 ${accent}` : "border-border")}>
      {isWinner && (
        <div className={cn("absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white", badgeBg)}>
          <Trophy className="w-3 h-3" /> Winner
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <span className={cn("text-[10px] font-bold uppercase tracking-widest", textAccent)}>{label}</span>
          <h3 className="text-sm font-semibold text-foreground mt-0.5 truncate">{profile.suiteName}</h3>
          <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">{profile.agentUrl}</p>
        </div>
        <div className={cn("text-3xl font-bold flex-shrink-0 ml-2", textAccent)}>{overallScore}</div>
      </div>

      <div className={cn("rounded-md px-3 py-2.5 grid grid-cols-2 gap-2 text-xs", bgAccent)}>
        <div>
          <div className="text-muted-foreground mb-0.5">Pass Rate</div>
          <div className={cn("font-semibold", textAccent)}>{profile.passRate}%</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Tests Run</div>
          <div className="font-semibold text-foreground">{profile.totalTests}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Avg Semantic</div>
          <div className={cn("font-semibold", textAccent)}>{profile.avgSemanticScore}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Avg Tokens</div>
          <div className="font-semibold text-foreground">{profile.avgTokenUsage}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Avg Steps</div>
          <div className="font-semibold text-foreground">{profile.avgStepCount}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Judge</div>
          <div className="font-medium text-foreground truncate">{profile.judgeModel ?? "default"}</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3 text-xs">
        <span className="flex items-center gap-0.5 text-emerald-500 font-medium">
          <CheckCircle2 className="w-3 h-3" /> {profile.passCount}
        </span>
        <span className="flex items-center gap-0.5 text-red-400 font-medium">
          <XCircle className="w-3 h-3" /> {profile.failCount}
        </span>
        <Link href={`/runs/${profile.runId}`} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
          Run <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

export default function ComparePage() {
  const [runs, setRuns] = useState<RunOption[]>([])
  const [runA, setRunA] = useState("")
  const [runB, setRunB] = useState("")
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runsLoading, setRunsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data: RunOption[]) => setRuns(data.filter((r) => r.status === "completed")))
      .catch(() => {})
      .finally(() => setRunsLoading(false))
  }, [])

  async function handleCompare() {
    if (!runA || !runB) return
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/compare?runA=${runA}&runB=${runB}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Comparison failed"); return }
      setResult(data as ComparisonResult)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  function runLabel(r: RunOption) {
    return `${r.suiteName} — ${fmtDate(r.startedAt)} (${r.passCount}/${r.totalTests} passed)`
  }

  const winner = result?.benchmark.overall.winner

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
          Agent Comparison
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Benchmark two runs head-to-head across accuracy, semantic quality, efficiency, and speed.
        </p>
      </div>

      {/* Selectors */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_32px_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Agent A</label>
            <select
              value={runA}
              onChange={(e) => setRunA(e.target.value)}
              disabled={runsLoading}
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">{runsLoading ? "Loading…" : "Select a run…"}</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id} disabled={r.id === runB}>{runLabel(r)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end justify-center pb-1">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">Agent B</label>
            <select
              value={runB}
              onChange={(e) => setRunB(e.target.value)}
              disabled={runsLoading}
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">{runsLoading ? "Loading…" : "Select a run…"}</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id} disabled={r.id === runA}>{runLabel(r)}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCompare}
            disabled={!runA || !runB || loading || runA === runB}
            className="h-9 px-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-md transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            {loading ? "…" : "Compare"}
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {runs.length === 0 && !runsLoading && (
          <p className="mt-3 text-xs text-muted-foreground text-center">
            No completed runs. <Link href="/suites" className="text-primary hover:underline">Run a test suite</Link> first.
          </p>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          {/* Winner banner */}
          <div className={cn(
            "rounded-lg border px-4 py-3 flex items-center gap-3",
            winner === "a" ? "bg-blue-500/10 border-blue-500/20" :
            winner === "b" ? "bg-violet-500/10 border-violet-500/20" :
            "bg-muted border-border"
          )}>
            <Trophy className={cn("w-6 h-6 flex-shrink-0",
              winner === "a" ? "text-blue-500" :
              winner === "b" ? "text-violet-500" : "text-muted-foreground"
            )} />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {winner === "tie" ? "It's a tie!" :
                 winner === "a" ? `Agent A wins — ${result.runA.suiteName}` :
                 `Agent B wins — ${result.runB.suiteName}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overall: A <strong className="text-foreground">{result.benchmark.overall.scoreA}</strong> vs B{" "}
                <strong className="text-foreground">{result.benchmark.overall.scoreB}</strong>
                {winner !== "tie" && (
                  <span className="ml-1.5 text-emerald-500 font-medium">
                    +{Math.abs(result.benchmark.overall.scoreA - result.benchmark.overall.scoreB)} lead
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Agent cards */}
          <div className="flex gap-3 items-stretch">
            <AgentCard profile={result.runA} label="Agent A" color="blue" overallScore={result.benchmark.overall.scoreA} isWinner={winner === "a"} />
            <div className="flex items-center text-muted-foreground/40 font-bold text-base px-1">vs</div>
            <AgentCard profile={result.runB} label="Agent B" color="violet" overallScore={result.benchmark.overall.scoreB} isWinner={winner === "b"} />
          </div>

          {/* Benchmark breakdown */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Benchmark Breakdown</h2>
                <p className="text-[11px] text-muted-foreground">Scores 0–100</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-wide">
                <span className="text-blue-500">A</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-violet-500">B</span>
              </div>
            </div>
            <div className="px-4 divide-y divide-border">
              {BENCHMARK_DIMS.map((dim) => (
                <div key={dim.key}>
                  <div className="flex items-center gap-1.5 pt-2.5 pb-1">
                    <dim.icon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">{dim.label}</span>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">— {dim.description}</span>
                  </div>
                  <BenchmarkRow dim={dim} data={result.benchmark[dim.key]} />
                </div>
              ))}
            </div>
          </div>

          {/* Per-test table */}
          {result.matchedTests.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Per-Test Breakdown</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {result.matchedTests.filter((t) => t.a && t.b).length} shared ·{" "}
                  {result.matchedTests.filter((t) => !t.a || !t.b).length} unique to one run
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="py-2 px-4 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Test</th>
                      <th className="py-2 px-3 text-center text-[11px] font-semibold text-blue-500 uppercase tracking-wide" colSpan={3}>Agent A</th>
                      <th className="py-2 px-3 text-center text-[11px] font-semibold text-violet-500 uppercase tracking-wide" colSpan={3}>Agent B</th>
                      <th className="py-2 px-3 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Edge</th>
                    </tr>
                    <tr className="border-b border-border">
                      <th className="py-1.5 px-4" />
                      {["Pass","Sem","Tok","Pass","Sem","Tok"].map((h, i) => (
                        <th key={i} className="py-1.5 px-3 text-center text-[10px] text-muted-foreground">{h}</th>
                      ))}
                      <th className="py-1.5 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.matchedTests.map((test) => {
                      const aScore = test.a?.semanticScore
                      const bScore = test.b?.semanticScore
                      const aBetter = aScore != null && bScore != null && aScore > bScore
                      const bBetter = aScore != null && bScore != null && bScore > aScore
                      return (
                        <tr key={test.testCaseId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-2 px-4 text-sm text-foreground font-medium">{test.testCaseName}</td>
                          <td className="py-2 px-3 text-center">
                            {test.a == null ? <Minus className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" />
                              : test.a.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              : <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-medium">
                            <span className={aBetter ? "text-blue-500" : "text-muted-foreground"}>{aScore ?? "—"}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-xs text-muted-foreground">{test.a?.tokenUsage ?? "—"}</td>
                          <td className="py-2 px-3 text-center">
                            {test.b == null ? <Minus className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" />
                              : test.b.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              : <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                          </td>
                          <td className="py-2 px-3 text-center text-xs font-medium">
                            <span className={bBetter ? "text-violet-500" : "text-muted-foreground"}>{bScore ?? "—"}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-xs text-muted-foreground">{test.b?.tokenUsage ?? "—"}</td>
                          <td className="py-2 px-3 text-center text-xs font-semibold">
                            {test.a && test.b
                              ? aBetter ? <span className="text-blue-500">A</span>
                                : bBetter ? <span className="text-violet-500">B</span>
                                : <span className="text-muted-foreground/40">—</span>
                              : <span className="text-muted-foreground/30">N/A</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
