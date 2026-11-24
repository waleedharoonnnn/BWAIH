"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function DeleteRunButton({ runId, suiteName }: { runId: string; suiteName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Delete this run of "${suiteName}" and its results? This cannot be undone.`)) return
    setLoading(true)
    const tid = toast.loading("Deleting run…")
    try {
      const res = await fetch(`/api/runs/${runId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Run deleted", { id: tid })
        router.refresh()
      } else {
        toast.error("Failed to delete run", { id: tid })
      }
    } catch {
      toast.error("Network error — please try again", { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Delete run"
      className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  )
}
