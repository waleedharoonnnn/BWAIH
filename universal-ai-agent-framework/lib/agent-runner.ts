import dns from "node:dns/promises"
import net from "node:net"
import type { TraceStep } from "./types"

const AGENT_TIMEOUT_MS = 45_000

export class AgentRunnerError extends Error {
  constructor(
    message: string,
    public readonly code: "TIMEOUT" | "AUTH_ERROR" | "NETWORK_ERROR" | "INVALID_RESPONSE" | "FORBIDDEN_HOST"
  ) {
    super(message)
    this.name = "AgentRunnerError"
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false
  const [a, b] = parts
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")
}

// Blocks SSRF against internal/private infrastructure. Local dev is exempt so the app
// can test agents running on localhost during development.
async function assertPublicHost(urlString: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return

  const { hostname } = new URL(urlString)
  if (hostname === "localhost") {
    throw new AgentRunnerError("Agent URL may not target localhost in production", "FORBIDDEN_HOST")
  }

  const addresses = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true }).catch(() => [])).map((r) => r.address)

  for (const addr of addresses) {
    if (isPrivateIPv4(addr) || isPrivateIPv6(addr)) {
      throw new AgentRunnerError(
        `Agent URL resolves to a private/internal address (${addr}), which is not allowed`,
        "FORBIDDEN_HOST"
      )
    }
  }
}

function resolveUrl(url: string): string {
  // On Vercel, prefer the production domain: per-deployment URLs (VERCEL_URL) sit behind
  // Deployment Protection and would answer server-side calls with 401.
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  const base = vercelHost
    ? `https://${vercelHost}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Relative path → prepend base
  if (url.startsWith("/")) return `${base}${url}`

  // Localhost URL running in a deployed environment → swap host
  if (
    (url.includes("localhost") || url.includes("127.0.0.1")) &&
    base !== "http://localhost:3000"
  ) {
    try {
      const parsed = new URL(url)
      const baseUrl = new URL(base)
      parsed.protocol = baseUrl.protocol
      parsed.host = baseUrl.host
      return parsed.toString()
    } catch {
      return url
    }
  }

  return url
}

type Json = Record<string, unknown>

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v)

function firstString(obj: Json, keys: string[]): string | undefined {
  for (const k of keys) if (typeof obj[k] === "string") return obj[k] as string
  return undefined
}

function parseArgs(v: unknown): Record<string, unknown> {
  if (isObj(v)) return v
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return isObj(p) ? p : { input: v } } catch { return { input: v } }
  }
  return v === undefined ? {} : { input: v }
}

function stringify(v: unknown): string {
  if (v === undefined || v === null) return ""
  return typeof v === "string" ? v : JSON.stringify(v)
}

/** Normalizes one step from any common agent format into a TraceStep. */
function toTraceStep(raw: unknown, i: number): TraceStep | null {
  // LangChain intermediate_steps: [action, observation]
  if (Array.isArray(raw) && raw.length === 2 && isObj(raw[0])) {
    const [action, observation] = raw as [Json, unknown]
    return { step: i + 1, tool: String(action.tool ?? "unknown"), params: parseArgs(action.tool_input), result: stringify(observation), timestamp: Date.now() }
  }
  if (!isObj(raw)) return null
  const fn = isObj(raw.function) ? raw.function : undefined
  const tool = firstString(raw, ["tool", "name", "tool_name", "toolName"]) ?? (fn && firstString(fn, ["name"]))
  if (!tool) return null
  return {
    step: typeof raw.step === "number" ? raw.step : i + 1,
    tool,
    params: parseArgs(raw.params ?? raw.args ?? raw.arguments ?? raw.input ?? raw.tool_input ?? fn?.arguments),
    result: stringify(raw.result ?? raw.output ?? raw.observation ?? raw.content),
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now(),
  }
}

function extractTrace(data: Json): TraceStep[] {
  let steps: unknown[] | undefined
  for (const k of ["trace", "steps", "tool_calls", "toolCalls", "intermediate_steps"]) {
    if (Array.isArray(data[k])) { steps = data[k] as unknown[]; break }
  }
  // OpenAI chat completion
  if (!steps && Array.isArray(data.choices) && isObj(data.choices[0]) && isObj(data.choices[0].message)) {
    const tc = data.choices[0].message.tool_calls
    if (Array.isArray(tc)) steps = tc
  }
  // Anthropic messages API
  if (!steps && Array.isArray(data.content)) {
    steps = (data.content as unknown[]).filter((b) => isObj(b) && b.type === "tool_use")
  }
  return (steps ?? []).map(toTraceStep).filter((s): s is TraceStep => s !== null)
}

function extractText(data: Json): string {
  const direct = firstString(data, ["response", "output", "answer", "text", "result", "reply", "final_answer", "message", "content"])
  if (direct !== undefined) return direct
  for (const k of ["output", "result", "message", "data"]) {
    if (isObj(data[k])) {
      const nested = extractText(data[k] as Json)
      if (nested) return nested
    }
  }
  if (Array.isArray(data.choices) && isObj(data.choices[0])) {
    const c = data.choices[0]
    if (isObj(c.message) && typeof c.message.content === "string") return c.message.content
    if (typeof c.text === "string") return c.text
  }
  if (Array.isArray(data.content)) {
    return (data.content as unknown[])
      .filter((b): b is Json => isObj(b) && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("\n")
  }
  return ""
}

function extractTokens(data: Json): number {
  if (typeof data.token_usage === "number") return data.token_usage
  if (typeof data.tokens === "number") return data.tokens
  if (isObj(data.usage)) {
    const u = data.usage
    if (typeof u.total_tokens === "number") return u.total_tokens
    const sum = (Number(u.input_tokens) || 0) + (Number(u.output_tokens) || 0)
    if (sum) return sum
  }
  return 0
}

export async function runTestCase(
  agentUrl: string,
  authKey: string | null,
  triggerPrompt: string
): Promise<{ trace: TraceStep[]; response: string; tokenUsage: number; stepCount: number }> {
  agentUrl = resolveUrl(agentUrl)
  await assertPublicHost(agentUrl)

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" }
  if (authKey) headers["Authorization"] = `Bearer ${authKey}`

  let res: Response
  try {
    res = await fetch(agentUrl, {
      method: "POST",
      headers,
      // `prompt` is the AgentTest contract; `input`/`message` cover most other agent servers.
      body: JSON.stringify({ prompt: triggerPrompt, input: triggerPrompt, message: triggerPrompt }),
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AgentRunnerError(`Agent timed out after ${AGENT_TIMEOUT_MS / 1000} seconds`, "TIMEOUT")
    }
    throw new AgentRunnerError(
      `Network error reaching agent: ${err instanceof Error ? err.message : String(err)}`,
      "NETWORK_ERROR"
    )
  }

  if (res.status === 401 || res.status === 403) {
    throw new AgentRunnerError(`Agent returned ${res.status} — check your auth key`, "AUTH_ERROR")
  }

  const bodyText = await res.text()
  if (!res.ok) {
    throw new AgentRunnerError(
      `Agent returned HTTP ${res.status}${
        bodyText && !bodyText.trimStart().startsWith("<") ? `: ${bodyText.slice(0, 200)}` : res.statusText ? ` ${res.statusText}` : ""
      }`,
      "NETWORK_ERROR"
    )
  }

  let data: unknown
  try {
    data = JSON.parse(bodyText)
  } catch {
    // Plain-text agent: no trace, response is the body.
    if (!bodyText.trim()) throw new AgentRunnerError("Agent returned an empty response", "INVALID_RESPONSE")
    return { trace: [], response: bodyText, tokenUsage: 0, stepCount: 0 }
  }

  if (typeof data === "string") return { trace: [], response: data, tokenUsage: 0, stepCount: 0 }
  if (!isObj(data)) throw new AgentRunnerError("Agent response must be a JSON object or text", "INVALID_RESPONSE")

  const trace = extractTrace(data)
  const response = extractText(data)
  if (!response && trace.length === 0) {
    throw new AgentRunnerError(
      `Could not find a response or tool trace in the agent output: ${bodyText.slice(0, 200)}`,
      "INVALID_RESPONSE"
    )
  }

  return {
    trace,
    response,
    tokenUsage: extractTokens(data),
    stepCount: typeof data.step_count === "number" ? data.step_count : trace.length,
  }
}
