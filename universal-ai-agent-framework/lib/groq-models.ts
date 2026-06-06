export type GroqModel = {
  id: string
  label: string
  description: string
  speed: "fast" | "balanced" | "powerful"
  contextWindow: string
}

export const GROQ_MODELS: GroqModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile",
    description: "Best quality, great for deep analysis",
    speed: "powerful",
    contextWindow: "128k",
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Fastest, good for simple checks",
    speed: "fast",
    contextWindow: "128k",
  },
  {
    id: "llama3-70b-8192",
    label: "Llama 3 70B",
    description: "Strong reasoning, 8k context",
    speed: "balanced",
    contextWindow: "8k",
  },
  {
    id: "llama3-8b-8192",
    label: "Llama 3 8B",
    description: "Very fast, lightweight",
    speed: "fast",
    contextWindow: "8k",
  },
  {
    id: "mixtral-8x7b-32768",
    label: "Mixtral 8x7B",
    description: "MoE model, fast and capable",
    speed: "balanced",
    contextWindow: "32k",
  },
  {
    id: "gemma2-9b-it",
    label: "Gemma 2 9B",
    description: "Google's efficient model",
    speed: "fast",
    contextWindow: "8k",
  },
]

export const DEFAULT_JUDGE_MODEL = "llama-3.3-70b-versatile"

export const SPEED_CONFIG = {
  fast: { label: "Fast", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  balanced: { label: "Balanced", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  powerful: { label: "Powerful", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
} as const
