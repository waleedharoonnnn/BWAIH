import { cn } from "@/lib/utils"

type Props = {
  expected: string[]
  actual: string[]
}

export function ToolSequenceDiff({ expected, actual }: Props) {
  const maxLen = Math.max(expected.length, actual.length)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Expected</div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: maxLen }).map((_, i) => {
            const tool = expected[i]
            if (!tool) {
              return <div key={i} className="h-7 rounded-md border border-dashed border-border bg-muted/30" />
            }
            const match = actual[i] === tool
            const present = actual.includes(tool)
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border",
                  match
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : present
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                )}
              >
                <span className="w-3 h-3 rounded-full bg-current opacity-30 flex-shrink-0" />
                <span className="font-mono truncate">{tool}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Actual</div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: maxLen }).map((_, i) => {
            const tool = actual[i]
            if (!tool) {
              return <div key={i} className="h-7 rounded-md border border-dashed border-border bg-muted/30" />
            }
            const match = expected[i] === tool
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium border",
                  match
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                )}
              >
                <span className="w-3 h-3 rounded-full bg-current opacity-30 flex-shrink-0" />
                <span className="font-mono truncate">{tool}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
