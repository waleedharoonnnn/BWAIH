"use client"

import {
  Bar, BarChart, CartesianGrid, XAxis, YAxis,
  Area, AreaChart,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type RunBar = {
  label: string
  passRate: number
  passed: number
  failed: number
}

type TrendPoint = {
  label: string
  passRate: number
}

const barConfig = {
  passRate: { label: "Pass Rate", color: "var(--chart-1)" },
} satisfies ChartConfig

const areaConfig = {
  passRate: { label: "Pass Rate", color: "var(--chart-1)" },
} satisfies ChartConfig

export function PassRateBarChart({ data }: { data: RunBar[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        No completed runs yet
      </div>
    )
  }
  return (
    <ChartContainer config={barConfig} className="h-44 w-full">
      <BarChart data={data} barSize={28} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}%`, "Pass Rate"]}
            />
          }
        />
        <Bar
          dataKey="passRate"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}

export function PassRateTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Need at least 2 runs for trend
      </div>
    )
  }
  return (
    <ChartContainer config={areaConfig} className="h-44 w-full">
      <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="passRateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}%`, "Pass Rate"]}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="passRate"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#passRateGrad)"
          dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
