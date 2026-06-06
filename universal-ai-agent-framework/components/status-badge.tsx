import { cn } from "@/lib/utils"

type Status = "passed" | "failed" | "running" | "pending" | "completed"

const CONFIG: Record<Status, { label: string; dot: string; pill: string }> = {
  passed: {
    label: "Passed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  failed: {
    label: "Failed",
    dot: "bg-red-500",
    pill: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  running: {
    label: "Running",
    dot: "bg-primary animate-pulse",
    pill: "bg-primary/10 text-primary border-primary/20",
  },
  pending: {
    label: "Pending",
    dot: "bg-muted-foreground",
    pill: "bg-muted text-muted-foreground border-border",
  },
  completed: {
    label: "Completed",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
}

type Props = {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.pending
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border",
        cfg.pill,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  )
}
