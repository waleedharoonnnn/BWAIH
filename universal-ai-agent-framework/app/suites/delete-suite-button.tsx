"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function DeleteSuiteButton({ suiteId, suiteName }: { suiteId: string; suiteName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Delete suite "${suiteName}" and all its test cases? This cannot be undone.`)) return
    setLoading(true)
    const tid = toast.loading("Deleting suite…")
    try {
      const res = await fetch(`/api/suites/${suiteId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Suite deleted", { id: tid })
        router.refresh()
      } else {
        toast.error("Failed to delete suite", { id: tid })
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
      className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  )
}
