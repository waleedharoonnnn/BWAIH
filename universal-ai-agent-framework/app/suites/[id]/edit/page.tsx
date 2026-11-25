import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { testSuites } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { EditSuiteForm } from "./form"

export default async function EditSuitePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const [suite] = await db.select().from(testSuites).where(eq(testSuites.id, id))
  if (!suite) notFound()

  return (
    <EditSuiteForm
      suiteId={suite.id}
      initial={{
        name: suite.name,
        description: suite.description ?? "",
        agentUrl: suite.agentUrl,
        judgeModel: suite.judgeModel ?? undefined,
        repeatCount: suite.repeatCount,
        hasAuthKey: suite.agentAuthKey !== null,
      }}
    />
  )
}
