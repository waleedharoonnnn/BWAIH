"use client"

import { useState, KeyboardEvent } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
}

export function TagInput({ value, onChange, placeholder = "Type and press Enter…", className }: Props) {
  const [input, setInput] = useState("")

  function addTag() {
    const tag = input.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 p-2 min-h-[38px] border border-border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring",
        className
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium border border-primary/20"
        >
          <span className="font-mono">{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:text-primary/60 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
      />
    </div>
  )
}
