import type { AgentResponse, TraceStep } from "./types"

export class AgentRunnerError extends Error {
  constructor(
    message: string,
    public readonly code: "TIMEOUT" | "AUTH_ERROR" | "NETWORK_ERROR" | "INVALID_RESPONSE"
  ) {
    super(message)
    this.name = "AgentRunnerError"
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
