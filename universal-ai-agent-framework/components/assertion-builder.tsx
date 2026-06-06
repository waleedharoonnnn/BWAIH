"use client"

import { Plus, Trash2 } from "lucide-react"
import type { Assertion } from "@/lib/db/schema"

const ASSERTION_TYPES: { value: Assertion["type"]; label: string; hint: string }[] = [
  { value: "tool_called", label: "Tool Called", hint: "Tool name (e.g. search_kb)" },
  { value: "tool_order", label: "Tool Order", hint: "Comma-separated tool names in order" },
  { value: "step_limit", label: "Step Limit", hint: "Max steps (number)" },
  { value: "param_type", label: "Param Type", hint: "tool_name:param_name:type (e.g. search_kb:query:string)" },
  { value: "output_contains", label: "Output Contains", hint: "String that must appear in response" },
  { value: "output_not_contains", label: "Output Not Contains", hint: "String that must NOT appear in response" },
]

type Props = {
  value: Assertion[]
  onChange: (assertions: Assertion[]) => void
}

export function AssertionBuilder({ value, onChange }: Props) {
  function add() {
    onChange([...value, { type: "tool_called", value: "", description: "" }])
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function update(i: number, field: keyof Assertion, val: string) {
    const updated = value.map((a, idx) => {
      if (idx !== i) return a
      if (field === "type") return { ...a, type: val as Assertion["type"], value: "" }
      if (field === "value") {
        const type = a.type
        if (type === "tool_order") return { ...a, value: val.split(",").map((s) => s.trim()).filter(Boolean) }
        if (type === "step_limit") return { ...a, value: parseInt(val) || 0 }
        return { ...a, value: val }
      }
      return { ...a, [field]: val }
    })
    onChange(updated)
  }

  function getValueString(a: Assertion): string {
    if (Array.isArray(a.value)) return (a.value as string[]).join(", ")
    return String(a.value)
  }

  return (
    <div className="space-y-2">
      {value.map((assertion, i) => {
        const meta = ASSERTION_TYPES.find((t) => t.value === assertion.type)
        return (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start p-3 bg-muted/40 rounded-md border border-border">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select
                value={assertion.type}
                onChange={(e) => update(i, "type", e.target.value)}
                className="w-full h-8 px-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ASSERTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Value</label>
              <input
                type="text"
                value={getValueString(assertion)}
                onChange={(e) => update(i, "value", e.target.value)}
                placeholder={meta?.hint}
                className="w-full h-8 px-2.5 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
              <input
                type="text"
                value={assertion.description}
                onChange={(e) => update(i, "description", e.target.value)}
                placeholder="What this checks…"
                className="w-full h-8 px-2.5 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-5 p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add assertion
      </button>
    </div>
  )
}
