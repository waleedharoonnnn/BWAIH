export type GroqModel = {
  id: string
  label: string
  description: string
  speed: "fast" | "balanced" | "powerful"
  contextWindow: string
}

export const GROQ_MODELS: GroqModel[] = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "Best quality, great for deep analysis",
    speed: "powerful",
    contextWindow: "128k",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Fastest, good for simple checks",
    speed: "fast",
    contextWindow: "128k",
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen3.8 27B",
    description: "Strong reasoning, balanced speed",
    speed: "balanced",
    contextWindow: "32k",
  },
]

export const DEFAULT_JUDGE_MODEL = "openai/gpt-oss-20b"

export const SPEED_CONFIG = {
  fast: { label: "Fast", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  balanced: { label: "Balanced", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  powerful: { label: "Powerful", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
} as const
