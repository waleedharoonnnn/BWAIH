"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { TagInput } from "@/components/tag-input"
import { AssertionBuilder } from "@/components/assertion-builder"
import type { Assertion } from "@/lib/db/schema"

export function NewTestCaseForm({ suiteId }: { suiteId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [triggerPrompt, setTriggerPrompt] = useState("")
  const [expectedToolSequence, setExpectedToolSequence] = useState<string[]>([])
  const [goldenResponse, setGoldenResponse] = useState("")
  const [assertions, setAssertions] = useState<Assertion[]>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) { toast.error("Test case name is required"); return }
    if (!triggerPrompt.trim()) { toast.error("Trigger prompt is required"); return }

    const invalidAssertion = assertions.find((a) => !String(a.value).trim())
    if (invalidAssertion) {
      toast.error(`Assertion "${invalidAssertion.type}" is missing a value`)
      return
    }

    setLoading(true)
    const tid = toast.loading("Saving test case…")
    try {
      const res = await fetch("/api/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suiteId,
          name: name.trim(),
          triggerPrompt: triggerPrompt.trim(),
          expectedToolSequence: expectedToolSequence.length > 0 ? expectedToolSequence : undefined,
          goldenResponse: goldenResponse.trim() || undefined,
          assertions: assertions.length > 0 ? assertions : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? "Failed to create test case"
        toast.error(typeof msg === "string" ? msg : JSON.stringify(msg), { id: tid })
        return
      }
      toast.success("Test case saved!", { id: tid })
      router.push(`/suites/${suiteId}`)
    } catch {
      toast.error("Network error — please try again", { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/suites/${suiteId}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to suite
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Add Test Case</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Define what your agent should do and how to verify it</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-semibold text-foreground pb-2 border-b border-border">Basic Info</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Test Case Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Basic knowledge lookup"
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Trigger Prompt <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              value={triggerPrompt}
              onChange={(e) => setTriggerPrompt(e.target.value)}
              placeholder="The exact prompt sent to your agent…"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-xs font-semibold text-foreground pb-2 border-b border-border">Expected Behavior</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Expected Tool Sequence <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <TagInput
              value={expectedToolSequence}
              onChange={setExpectedToolSequence}
              placeholder="Type a tool name and press Enter…"
            />
            <p className="mt-1 text-xs text-muted-foreground">Add tool names in the order you expect the agent to call them</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Golden Response <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <textarea
              value={goldenResponse}
              onChange={(e) => setGoldenResponse(e.target.value)}
              placeholder="The ideal response for semantic comparison…"
              rows={4}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-xs font-semibold text-foreground pb-2 border-b border-border mb-4">
            Assertions <span className="text-muted-foreground font-normal">(optional)</span>
          </h2>
          <AssertionBuilder value={assertions} onChange={setAssertions} />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-sm font-medium rounded-md transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {loading ? "Saving…" : "Save Test Case"}
          </button>
          <Link
            href={`/suites/${suiteId}`}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
