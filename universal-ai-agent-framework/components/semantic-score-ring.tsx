import { cn } from "@/lib/utils"

type Props = {
  score: number
  size?: number
}

export function SemanticScoreRing({ score, size = 80 }: Props) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const offset = circumference - (progress / 100) * circumference

  const strokeColor =
    progress >= 80 ? "#10b981" :  // emerald-500
    progress >= 50 ? "#f59e0b" :  // amber-500
    "#ef4444"                      // red-500

  const textColor =
    progress >= 80 ? "text-emerald-500" :
    progress >= 50 ? "text-amber-500" :
    "text-red-500"

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={6}
          fill="none"
          style={{ stroke: "var(--border)" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={6}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className={cn("absolute text-sm font-bold tabular-nums", textColor)}>
        {score}
      </span>
    </div>
  )
}
