import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { db } from "@/lib/db"
import { testSuites, testCases } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { RunLiveFeed } from "@/components/run-live-feed"

export default async function SuiteRunPage(props: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const runId = searchParams?.runId as string | undefined

  if (!runId) redirect(`/suites/${id}`)

  const [suite] = await db.select().from(testSuites).where(eq(testSuites.id, id))
  if (!suite) notFound()

  const cases = await db.select().from(testCases).where(eq(testCases.suiteId, id))

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/suites/${id}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to suite
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Live Run</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Executing <span className="font-medium text-foreground">{suite.name}</span> against {suite.agentUrl}
        </p>
      </div>

      <RunLiveFeed runId={runId} suiteName={suite.name} totalCases={cases.length} />
    </div>
  )
}
