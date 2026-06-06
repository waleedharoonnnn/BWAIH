"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Bot } from "lucide-react"
import { toast } from "sonner"
import { GROQ_MODELS, DEFAULT_JUDGE_MODEL, SPEED_CONFIG } from "@/lib/groq-models"
import { cn } from "@/lib/utils"

export default function NewSuitePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    agentUrl: "",
    agentAuthKey: "",
    judgeModel: DEFAULT_JUDGE_MODEL,
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) { toast.error("Suite name is required"); return }
    if (!form.agentUrl.trim()) { toast.error("Agent API URL is required"); return }
    try { new URL(form.agentUrl) } catch { toast.error("Agent API URL must be a valid URL"); return }

    setLoading(true)
    const tid = toast.loading("Creating suite…")
    try {
      const res = await fetch("/api/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description || undefined,
          agentUrl: form.agentUrl.trim(),
          agentAuthKey: form.agentAuthKey || undefined,
          judgeModel: form.judgeModel,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error?.formErrors?.[0] ?? data.error ?? "Failed to create suite"
        toast.error(typeof msg === "string" ? msg : JSON.stringify(msg), { id: tid })
        return
      }
      toast.success("Suite created!", { id: tid })
      router.push(`/suites/${data.id}`)
    } catch {
      toast.error("Network error — please try again", { id: tid })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <Link href="/suites" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to suites
        </Link>
        <h1 className="text-xl font-semibold text-foreground">New Test Suite</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Configure a test suite pointing to your agent</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Suite Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. RAG Search Agent Tests"
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What does this suite test?"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Agent API URL <span className="text-destructive">*</span>
            </label>
            <input
              type="url"
              required
              value={form.agentUrl}
              onChange={(e) => set("agentUrl", e.target.value)}
              placeholder="https://your-agent.api/endpoint"
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded text-foreground">http://localhost:3000/api/mock-agent</code> for the built-in mock
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Agent Auth Key <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <input
              type="password"
              value={form.agentAuthKey}
              onChange={(e) => set("agentAuthKey", e.target.value)}
              placeholder="Bearer token or API key"
              className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              Judge Model
              <span className="text-xs font-normal text-muted-foreground">— AI used for semantic scoring</span>
            </label>
            <div className="space-y-1.5">
              {GROQ_MODELS.map((m) => {
                const speed = SPEED_CONFIG[m.speed]
                const selected = form.judgeModel === m.id
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-all",
                      selected
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-border/80 hover:bg-muted/40"
                    )}
                  >
                    <input type="radio" name="judgeModel" value={m.id} checked={selected} onChange={() => set("judgeModel", m.id)} className="sr-only" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm font-medium", selected ? "text-primary" : "text-foreground")}>{m.label}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full border font-medium", speed.color, speed.bg, speed.border)}>
                          {speed.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{m.contextWindow} ctx</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    </div>
                    <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                      selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}>
                      {selected && <div className="w-full h-full rounded-full bg-primary-foreground scale-[0.4]" />}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-sm font-medium rounded-md transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {loading ? "Creating…" : "Create Suite"}
            </button>
            <Link
              href="/suites"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
