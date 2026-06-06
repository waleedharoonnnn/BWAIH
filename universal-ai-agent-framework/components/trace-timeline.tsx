"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TraceStep } from "@/lib/db/schema"

type Props = {
  trace: TraceStep[]
}

export function TraceTimeline({ trace }: Props) {
  const [expanded, setExpanded] = useState<number[]>([])

  function toggle(step: number) {
    setExpanded((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    )
  }

  if (trace.length === 0) {
    return <div className="text-sm text-muted-foreground italic">No trace steps recorded</div>
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-2.5">
        {trace.map((step) => {
          const open = expanded.includes(step.step)
          return (
            <div key={step.step} className="relative flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center z-10 text-primary-foreground text-xs font-bold">
                {step.step}
              </div>
              <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(step.step)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-mono text-sm font-medium text-foreground flex-1">{step.tool}</span>
                  <span className="text-xs text-muted-foreground">{new Date(step.timestamp).toLocaleTimeString()}</span>
                  {open ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                {open && (
                  <div className="border-t border-border px-3 py-2.5 space-y-2">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Params</div>
                      <pre className={cn(
                        "text-xs font-mono bg-muted rounded-md p-2 overflow-x-auto text-foreground",
                        "border border-border"
                      )}>
                        {JSON.stringify(step.params, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Result</div>
                      <pre className="text-xs font-mono bg-emerald-500/5 rounded-md p-2 overflow-x-auto text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {step.result}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
