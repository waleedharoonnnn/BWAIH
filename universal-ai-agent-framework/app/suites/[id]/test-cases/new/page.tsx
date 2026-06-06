import { NewTestCaseForm } from "./form"

export default async function NewTestCasePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <NewTestCaseForm suiteId={id} />
}
