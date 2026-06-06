import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: { value: string; positive: boolean }
  className?: string
}

export function StatsCard({ title, value, icon: Icon, trend, className }: Props) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
        <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {trend && (
        <div className={cn("mt-1 text-xs font-medium", trend.positive ? "text-emerald-500" : "text-red-500")}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  )
}
