import { NextRequest } from "next/server"
import type { TraceStep } from "@/lib/db/schema"

export const runtime = "nodejs"

const TOOL_LIBRARY: Record<string, { description: string; keywords: string[] }> = {
  search_knowledge_base: { description: "Search internal knowledge base", keywords: ["search", "find", "lookup", "query", "what", "who", "when"] },
  retrieve_documents: { description: "Retrieve relevant documents via RAG", keywords: ["document", "doc", "retrieve", "rag", "context"] },
  summarize_text: { description: "Summarize long text content", keywords: ["summarize", "summary", "brief", "condense", "shorten"] },
  classify_intent: { description: "Classify user intent category", keywords: ["classify", "category", "intent", "type", "kind"] },
  call_external_api: { description: "Call an external third-party API", keywords: ["api", "external", "fetch", "http", "endpoint"] },
  generate_response: { description: "Generate final natural language response", keywords: ["generate", "respond", "answer", "reply", "write"] },
  validate_input: { description: "Validate input schema and types", keywords: ["validate", "check", "verify", "ensure", "valid"] },
  format_output: { description: "Format output to required schema", keywords: ["format", "structure", "schema", "output", "json"] },
}

function makeTrace(tools: string[], prompt: string): TraceStep[] {
  return tools.map((tool, i) => ({
    step: i + 1,
    tool,
    params: buildParams(tool, prompt),
    result: buildResult(tool),
    timestamp: Date.now() + i * 350,
  }))
}

function buildParams(tool: string, prompt: string): Record<string, unknown> {
  switch (tool) {
    case "search_knowledge_base": return { query: prompt.slice(0, 80), top_k: 5 }
    case "retrieve_documents": return { query: prompt.slice(0, 80), limit: 3, rerank: true }
    case "summarize_text": return { text: "Lorem ipsum retrieved content...", max_length: 200 }
    case "classify_intent": return { text: prompt, categories: ["question", "command", "request"] }
    case "call_external_api": return { url: "https://api.example.com/data", method: "GET" }
    case "generate_response": return { context: "retrieved data", prompt, temperature: 0.7 }
    case "validate_input": return { schema: "UserQuery", input: { query: prompt } }
    case "format_output": return { data: { result: "processed" }, schema: "ResponseSchema" }
    default: return { input: prompt.slice(0, 50) }
  }
}

function buildResult(tool: string): string {
  switch (tool) {
    case "search_knowledge_base": return JSON.stringify({ hits: 5, relevance: 0.92 })
    case "retrieve_documents": return JSON.stringify({ documents: ["doc_1", "doc_2", "doc_3"] })
    case "summarize_text": return "Summary: The key points are that the system operates in three phases."
    case "classify_intent": return JSON.stringify({ intent: "question", confidence: 0.95 })
    case "call_external_api": return JSON.stringify({ status: 200, data: { value: 42 } })
    case "generate_response": return "Response generated successfully."
    case "validate_input": return JSON.stringify({ valid: true, errors: [] })
    case "format_output": return JSON.stringify({ formatted: true })
    default: return "success"
  }
}

function selectTools(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const selected: string[] = []
  for (const [tool, meta] of Object.entries(TOOL_LIBRARY)) {
    if (meta.keywords.some((kw) => lower.includes(kw))) {
      selected.push(tool)
    }
    if (selected.length >= 4) break
  }
  if (selected.length === 0) {
    selected.push("classify_intent", "generate_response")
  }
  if (!selected.includes("generate_response")) {
    selected.push("generate_response")
  }
  return selected
}

function buildResponse(prompt: string, tools: string[]): string {
  const p = prompt.toLowerCase()

  if (p.includes("escalat") || p.includes("critical") || p.includes("urgent") || p.includes("priority")) {
    return `This ticket has been classified as critical priority and escalated to the on-call support team. The escalation workflow was triggered, the relevant stakeholders have been notified, and the ticket status has been updated to ESCALATED. Expected response time is under 1 hour.`
  }
  if (p.includes("summar") || p.includes("brief") || p.includes("condense") || p.includes("tldr")) {
    return `Here is a concise summary: The document covers three key areas — system configuration, data validation, and output formatting. The main takeaway is that all operations completed successfully with no errors detected.`
  }
  if (p.includes("search") || p.includes("find") || p.includes("lookup") || p.includes("retrieve")) {
    return `I searched the knowledge base and retrieved 3 relevant documents. Based on the retrieved context, the requested information is available and has been compiled. The top result has a relevance score of 0.92.`
  }
  if (p.includes("classif") || p.includes("categor") || p.includes("intent") || p.includes("detect")) {
    return `Intent classification complete. The input has been categorized as a service request with 95% confidence. The appropriate processing workflow has been selected and initiated.`
  }
  if (p.includes("validat") || p.includes("verif") || p.includes("check schema") || p.includes("ensure")) {
    return `Validation passed. All input parameters conform to the required schema with no errors. The data integrity checks succeeded and the payload is ready for downstream processing.`
  }
  if (p.includes("format") || p.includes("convert") || p.includes("transform") || p.includes("structur")) {
    return `The output has been formatted according to the specified schema. All fields are correctly structured, required properties are present, and the response is ready for consumption by the downstream service.`
  }
  if (p.includes("api") || p.includes("fetch") || p.includes("http") || p.includes("endpoint") || p.includes("call")) {
    return `The external API call completed successfully with status 200. The response data has been parsed and the relevant fields extracted. The operation returned the expected payload without errors.`
  }
  if (p.includes("generat") || p.includes("write") || p.includes("compose") || p.includes("draft")) {
    return `The response has been generated based on the provided context and requirements. The output is coherent, addresses the key points from the prompt, and meets the specified format requirements.`
  }

  return `Request processed using ${tools.length} tools. The system retrieved the relevant context, validated the input, and completed the operation successfully. All steps finished without errors.`
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { prompt?: string }
    const prompt = body.prompt ?? "default test prompt"
    const mode = req.nextUrl.searchParams.get("mode") ?? "normal"

    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300))

    if (mode === "fail") {
      const wrongTools = ["classify_intent", "call_external_api", "validate_input"]
      const trace = makeTrace(wrongTools, prompt)
      return Response.json({
        response: "I encountered an issue processing this request. The classification step failed.",
        trace,
        token_usage: 312,
        step_count: wrongTools.length,
      })
    }

    if (mode === "hallucinate") {
      const tools = selectTools(prompt)
      const trace = makeTrace(tools, prompt)
      return Response.json({
        response: `Based on our records, the answer is 42.7 million users as of Q3 2024, which represents a 312% growth rate according to internal report XR-9921 filed on March 15th. The CEO confirmed this in a press release dated January 1st, 2025.`,
        trace,
        token_usage: 489,
        step_count: tools.length,
      })
    }

    const tools = selectTools(prompt)
    const trace = makeTrace(tools, prompt)
    const tokenUsage = 180 + Math.floor(Math.random() * 200)

    return Response.json({
      response: buildResponse(prompt, tools),
      trace,
      token_usage: tokenUsage,
      step_count: tools.length,
    })
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
}
