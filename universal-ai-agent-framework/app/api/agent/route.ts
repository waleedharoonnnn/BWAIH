import { NextRequest } from "next/server"
import Groq from "groq-sdk"
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions"
import type { TraceStep } from "@/lib/db/schema"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * A real LLM agent: Groq-hosted model + a tool-calling loop over live public APIs.
 * Contract: POST { prompt } → { response, trace, token_usage, step_count }
 * Protect it in production by setting AGENT_API_KEY (callers then send `Authorization: Bearer <key>`).
 */

const MODEL = process.env.AGENT_MODEL ?? "openai/gpt-oss-120b"
const MAX_TURNS = 6
const USER_AGENT = "AgentTest-DemoAgent/1.0"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_wikipedia",
      description: "Search Wikipedia and return summaries of the top matching articles. Use for factual questions about people, places, events, science, etc.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search terms" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a city.",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "City name, e.g. 'Lahore' or 'Paris'" } },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_currency",
      description: "Convert an amount between currencies using the latest exchange rates (ISO codes like USD, EUR, GBP).",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount to convert" },
          from: { type: "string", description: "Source currency ISO code" },
          to: { type: "string", description: "Target currency ISO code" },
        },
        required: ["amount", "from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Evaluate an arithmetic expression. Supports + - * / % ^ and parentheses.",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "e.g. '(12.5 * 4) / 3'" } },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date and time in an IANA timezone.",
      parameters: {
        type: "object",
        properties: { timezone: { type: "string", description: "IANA timezone, e.g. 'Asia/Karachi', 'America/New_York'" } },
        required: ["timezone"],
      },
    },
  },
]

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  return res.json()
}

async function searchWikipedia({ query }: { query: string }) {
  const search = (await getJson(
    `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=3`
  )) as { pages: { key: string; title: string }[] }
  const summaries = await Promise.all(
    search.pages.map(async (p) => {
      try {
        const s = (await getJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.key)}`
        )) as { title: string; extract: string }
        return { title: s.title, summary: s.extract }
      } catch {
        return { title: p.title, summary: "" }
      }
    })
  )
  return { results: summaries }
}

const WEATHER_CODES: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "violent rain showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail",
}

async function getWeather({ city }: { city: string }) {
  const geo = (await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  )) as { results?: { name: string; country: string; latitude: number; longitude: number }[] }
  const place = geo.results?.[0]
  if (!place) return { error: `City "${city}" not found` }
  const wx = (await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`
  )) as { current: { temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number } }
  return {
    location: `${place.name}, ${place.country}`,
    temperature_c: wx.current.temperature_2m,
    humidity_pct: wx.current.relative_humidity_2m,
    wind_kmh: wx.current.wind_speed_10m,
    conditions: WEATHER_CODES[wx.current.weather_code] ?? `code ${wx.current.weather_code}`,
  }
}

async function convertCurrency({ amount, from, to }: { amount: number; from: string; to: string }) {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  const data = (await getJson(
    `https://api.frankfurter.app/latest?amount=${Number(amount)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`
  )) as { date: string; rates: Record<string, number> }
  return { amount, from: f, to: t, result: data.rates[t], rate_date: data.date }
}

// Tiny recursive-descent parser so we never eval() model-supplied input.
function calculate(expr: string): number {
  const tokens = expr.match(/\d+(?:\.\d+)?|[-+*/%^()]/g) ?? []
  if (tokens.join("") !== expr.replace(/\s+/g, "")) throw new Error("Invalid characters in expression")
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  function primary(): number {
    const tok = next()
    if (tok === "(") {
      const v = additive()
      if (next() !== ")") throw new Error("Missing closing parenthesis")
      return v
    }
    if (tok === "-") return -primary()
    if (tok === "+") return primary()
    const n = Number(tok)
    if (tok === undefined || Number.isNaN(n)) throw new Error("Unexpected token")
    return n
  }
  function power(): number {
    const base = primary()
    if (peek() === "^") { next(); return base ** power() }
    return base
  }
  function multiplicative(): number {
    let v = power()
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next()
      const r = power()
      v = op === "*" ? v * r : op === "/" ? v / r : v % r
    }
    return v
  }
  function additive(): number {
    let v = multiplicative()
    while (peek() === "+" || peek() === "-") {
      const op = next()
      const r = multiplicative()
      v = op === "+" ? v + r : v - r
    }
    return v
  }

  const result = additive()
  if (pos !== tokens.length) throw new Error("Unexpected trailing input")
  return result
}

function getCurrentTime({ timezone }: { timezone: string }) {
  const now = new Date()
  return {
    timezone,
    local_time: now.toLocaleString("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "long" }),
  }
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_wikipedia": return searchWikipedia(args as { query: string })
    case "get_weather": return getWeather(args as { city: string })
    case "convert_currency": return convertCurrency(args as { amount: number; from: string; to: string })
    case "calculator": return { expression: args.expression, result: calculate(String(args.expression)) }
    case "get_current_time": return getCurrentTime(args as { timezone: string })
    default: throw new Error(`Unknown tool: ${name}`)
  }
}

export async function POST(req: NextRequest) {
  const requiredKey = process.env.AGENT_API_KEY
  if (requiredKey && req.headers.get("authorization") !== `Bearer ${requiredKey}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let prompt: string
  try {
    const body = (await req.json()) as { prompt?: unknown }
    if (typeof body.prompt !== "string" || !body.prompt.trim()) throw new Error()
    prompt = body.prompt
  } catch {
    return Response.json({ error: "Body must be JSON: { \"prompt\": string }" }, { status: 400 })
  }

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a helpful research assistant. Use the provided tools whenever a question needs live data, facts, or arithmetic — do not guess numbers. Keep final answers concise (2-4 sentences).",
    },
    { role: "user", content: prompt },
  ]
  const trace: TraceStep[] = []
  let tokenUsage = 0

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
      })
      tokenUsage += completion.usage?.total_tokens ?? 0
      const msg = completion.choices[0]?.message
      if (!msg) throw new Error("Model returned no message")

      if (!msg.tool_calls?.length) {
        return Response.json({
          response: msg.content ?? "",
          trace,
          token_usage: tokenUsage,
          step_count: trace.length,
        })
      }

      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls })

      for (const call of msg.tool_calls) {
        let params: Record<string, unknown> = {}
        let result: string
        try {
          params = JSON.parse(call.function.arguments || "{}")
          result = JSON.stringify(await executeTool(call.function.name, params))
        } catch (err) {
          result = JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
        }
        trace.push({ step: trace.length + 1, tool: call.function.name, params, result, timestamp: Date.now() })
        messages.push({ role: "tool", tool_call_id: call.id, content: result })
      }
    }

    return Response.json({
      response: "Stopped: reached the maximum number of tool-calling turns without a final answer.",
      trace,
      token_usage: tokenUsage,
      step_count: trace.length,
    })
  } catch (err) {
    console.error("POST /api/agent:", err)
    return Response.json(
      { error: `Agent failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }
}
