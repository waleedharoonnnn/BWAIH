"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Play, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function RunSuiteButton({ suiteId }: { suiteId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRun() {
    setLoading(true)
    const tid = toast.loading("Starting run…")
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
        toast.error(data.error ?? "Failed to start run", { id: tid })
      }
    } catch {
      toast.error("Network error — please try again", { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRun}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-sm font-medium rounded-lg transition-colors"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
      {loading ? "Starting…" : "Run Suite"}
    </button>
  )
}
