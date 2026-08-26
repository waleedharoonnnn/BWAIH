import dns from "node:dns/promises"
import net from "node:net"
import type { AgentResponse, TraceStep } from "./types"

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
// can still test against its own localhost mock agent during development.
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
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  // Relative path → prepend base
  if (url.startsWith("/")) return `${base}${url}`

  // Localhost URL running in a deployed environment → swap host
  if (
    (url.includes("localhost") || url.includes("127.0.0.1")) &&
    (process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL)
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

export async function runTestCase(
  agentUrl: string,
  authKey: string | null,
  triggerPrompt: string
): Promise<{ trace: TraceStep[]; response: string; tokenUsage: number; stepCount: number }> {
  agentUrl = resolveUrl(agentUrl)
  await assertPublicHost(agentUrl)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (authKey) {
    headers["Authorization"] = `Bearer ${authKey}`
  }

  let res: Response
  try {
    res = await fetch(agentUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: triggerPrompt }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === "AbortError") {
      throw new AgentRunnerError(
        `Agent timed out after 30 seconds`,
        "TIMEOUT"
      )
    }
    throw new AgentRunnerError(
      `Network error reaching agent: ${err instanceof Error ? err.message : String(err)}`,
      "NETWORK_ERROR"
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (res.status === 401 || res.status === 403) {
    throw new AgentRunnerError(
      `Agent returned ${res.status} — check your auth key`,
      "AUTH_ERROR"
    )
  }

  if (!res.ok) {
    throw new AgentRunnerError(
      `Agent returned HTTP ${res.status}: ${res.statusText}`,
      "NETWORK_ERROR"
    )
  }

  let data: AgentResponse
  try {
    data = (await res.json()) as AgentResponse
  } catch {
    throw new AgentRunnerError(
      "Agent response is not valid JSON",
      "INVALID_RESPONSE"
    )
  }

  if (!data.trace || !Array.isArray(data.trace)) {
    throw new AgentRunnerError(
      "Agent response missing required 'trace' array",
      "INVALID_RESPONSE"
    )
  }

  return {
    trace: data.trace,
    response: data.response ?? "",
    tokenUsage: data.token_usage ?? 0,
    stepCount: data.step_count ?? data.trace.length,
  }
}
