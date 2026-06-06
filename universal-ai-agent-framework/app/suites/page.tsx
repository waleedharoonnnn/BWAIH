export const dynamic = "force-dynamic"

import Link from "next/link"
import { Plus, FlaskConical, ExternalLink } from "lucide-react"
import { db } from "@/lib/db"
import { testSuites, testCases } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { DeleteSuiteButton } from "./delete-suite-button"

async function getSuites() {
  return db
    .select({
      id: testSuites.id,
      name: testSuites.name,
      description: testSuites.description,
      agentUrl: testSuites.agentUrl,
      judgeModel: testSuites.judgeModel,
      createdAt: testSuites.createdAt,
      testCaseCount: sql<number>`count(${testCases.id})::int`,
    })
    .from(testSuites)
    .leftJoin(testCases, eq(testCases.suiteId, testSuites.id))
    .groupBy(testSuites.id)
    .orderBy(testSuites.createdAt)
}

export default async function SuitesPage() {
  const suites = await getSuites()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Test Suites</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage and run your agent test suites</p>
        </div>
        <Link
          href="/suites/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Suite
        </Link>
      </div>

      {suites.length === 0 ? (
        <div className="bg-card border border-border rounded-lg px-6 py-14 text-center">
          <FlaskConical className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-foreground mb-1.5">No test suites yet</h2>
          <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
            Create your first test suite to start testing your AI agent against structured test cases.
          </p>
          <Link
            href="/suites/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create your first suite
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Agent URL</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Judge Model</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cases</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suites.map((suite) => (
                <tr key={suite.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/suites/${suite.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {suite.name}
                    </Link>
                    {suite.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{suite.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground truncate max-w-[160px] block">
                      {suite.agentUrl}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground truncate max-w-[120px] block">
                      {suite.judgeModel ?? "default"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {suite.testCaseCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {suite.createdAt ? new Date(suite.createdAt).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric"
                    }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Link
                        href={`/suites/${suite.id}`}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                      >
                        View
                      </Link>
                      <DeleteSuiteButton suiteId={suite.id} suiteName={suite.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
