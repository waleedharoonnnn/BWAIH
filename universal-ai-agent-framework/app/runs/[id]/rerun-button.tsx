"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function ReRunButton({ suiteId }: { suiteId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleReRun() {
    setLoading(true)
    const tid = toast.loading("Starting re-run…")
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suiteId }),
      })
      const data = await res.json()
      if (res.ok && data.runId) {
        toast.dismiss(tid)
        router.push(`/suites/${suiteId}/run?runId=${data.runId}`)
      } else {
        toast.error(data.error ?? "Failed to start re-run", { id: tid })
      }
    } catch {
      toast.error("Network error — please try again", { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReRun}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 border border-border hover:bg-muted disabled:opacity-60 text-foreground text-sm font-medium rounded-md transition-colors"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
      {loading ? "Starting…" : "Re-run"}
    </button>
  )
}
