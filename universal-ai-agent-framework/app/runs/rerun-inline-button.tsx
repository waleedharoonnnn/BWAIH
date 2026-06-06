"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function ReRunInlineButton({ suiteId }: { suiteId: string }) {
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
      className="p-1.5 text-muted-foreground hover:text-primary rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
      title="Re-run"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
    </button>
  )
}
