import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Plus } from "lucide-react"
import { db } from "@/lib/db"
import { testSuites, testCases } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { RunSuiteButton } from "./run-suite-button"
import { DeleteTestCaseButton } from "./delete-test-case-button"

export default async function SuiteDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const [suite] = await db.select().from(testSuites).where(eq(testSuites.id, id))
  if (!suite) notFound()

  const cases = await db.select().from(testCases).where(eq(testCases.suiteId, id)).orderBy(testCases.createdAt)

  return (
    <div className="space-y-5">
      <div>
        <Link href="/suites" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to suites
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{suite.name}</h1>
            {suite.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{suite.description}</p>
            )}
            <code className="text-xs text-muted-foreground/60 font-mono mt-1 block">{suite.agentUrl}</code>
          </div>
          <div className="flex items-center gap-2">
            <RunSuiteButton suiteId={suite.id} />
            <Link
              href={`/suites/${id}/edit`}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-muted hover:text-foreground transition-colors"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Test Cases <span className="text-muted-foreground font-normal">({cases.length})</span>
          </h2>
          <Link
            href={`/suites/${id}/test-cases/new`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Test Case
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Plus className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No test cases yet. Add your first to get started.</p>
            <Link
              href={`/suites/${id}/test-cases/new`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Test Case
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Expected Tools</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Assertions</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Golden Response</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.map((tc) => (
                <tr key={tc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{tc.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{tc.triggerPrompt}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {tc.expectedToolSequence?.slice(0, 3).map((tool) => (
                        <span key={tool} className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                          {tool}
                        </span>
                      ))}
                      {(tc.expectedToolSequence?.length ?? 0) > 3 && (
                        <span className="text-xs text-muted-foreground">+{(tc.expectedToolSequence?.length ?? 0) - 3}</span>
                      )}
                      {!tc.expectedToolSequence?.length && <span className="text-xs text-muted-foreground/40">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{tc.assertions?.length ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    {tc.goldenResponse ? (
                      <span className="text-xs text-emerald-500 font-medium">✓ Set</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Link
                        href={`/suites/${id}/test-cases/${tc.id}/edit`}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                      >
                        Edit
                      </Link>
                      <DeleteTestCaseButton testCaseId={tc.id} testCaseName={tc.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
