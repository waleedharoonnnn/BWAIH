import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { testCases } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NewTestCaseForm } from "../../new/form"

export default async function EditTestCasePage(props: { params: Promise<{ id: string; caseId: string }> }) {
  const { id, caseId } = await props.params
  const [tc] = await db.select().from(testCases).where(eq(testCases.id, caseId))
  if (!tc || tc.suiteId !== id) notFound()

  return (
    <NewTestCaseForm
      suiteId={id}
      testCaseId={tc.id}
      initial={{
        name: tc.name,
        triggerPrompt: tc.triggerPrompt,
        expectedToolSequence: tc.expectedToolSequence ?? [],
        goldenResponse: tc.goldenResponse ?? "",
        assertions: tc.assertions ?? [],
      }}
    />
  )
}
