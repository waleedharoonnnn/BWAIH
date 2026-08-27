"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard, FlaskConical, History, Zap,
  Sun, Moon, Monitor,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/suites", label: "Test Suites", icon: FlaskConical },
  { href: "/runs", label: "Run History", icon: History },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycles: Array<{ value: string; icon: React.ElementType; label: string }> = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ]

  const current = cycles.find((c) => c.value === theme) ?? cycles[2]
  const next = cycles[(cycles.indexOf(current) + 1) % cycles.length]

  return (
    <button
      onClick={() => setTheme(next.value)}
      title={`Switch to ${next.label} mode`}
      className="flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <current.icon className="w-4 h-4 flex-shrink-0" />
      <span>{current.label}</span>
    </button>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      {/* Brand */}
      <div className="px-3 py-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">ASTERA</span>
            <span className="block text-[10px] text-muted-foreground leading-none">AgentTest v1</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <p className="px-2.5 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Menu
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        <ThemeToggle />
      </div>
    </aside>
  )
}
