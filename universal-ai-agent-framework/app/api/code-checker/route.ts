import { NextRequest } from "next/server"
import { z } from "zod"
import Groq from "groq-sdk"
import { DEFAULT_JUDGE_MODEL, GROQ_MODELS } from "@/lib/groq-models"

export const runtime = "nodejs"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const VALID_MODEL_IDS = GROQ_MODELS.map((m) => m.id)

const schema = z.object({
  code: z.string().min(1).max(50000),
  language: z.string().default("auto"),
  context: z.string().optional(),
  model: z.string().default(DEFAULT_JUDGE_MODEL),
})

export type CodeCheckResult = {
  overallScore: number
  grade: "A" | "B" | "C" | "D" | "F"
  detectedLanguage: string
  summary: string
  metrics: {
    readability: number
    maintainability: number
    security: number
    complexity: number
    bestPractices: number
  }
  issues: Array<{
    severity: "critical" | "warning" | "info"
    category: string
    message: string
    suggestion: string
    line?: number
  }>
  strengths: string[]
  improvements: string[]
  aiGeneratedPatterns: string[]
}

const SYSTEM_PROMPT = `You are an expert code quality analyzer specializing in reviewing AI-generated code. Your job is to analyze code and return a detailed quality report in strict JSON format.

Evaluate the code on these dimensions (score 0-100 each):
- readability: naming, comments, structure clarity
- maintainability: modularity, coupling, cohesion, DRY principles
- security: input validation, injection risks, exposed secrets, unsafe operations
- complexity: cyclomatic complexity, nesting depth, function length
- bestPractices: language idioms, error handling, type safety, standards

For issues, classify severity:
- critical: security vulnerabilities, crashes, data loss risks
- warning: bugs, bad patterns, performance issues, missing error handling
- info: style, minor improvements, optimization opportunities

Also identify "AI-generated code patterns" — things that are common tells of AI-generated code:
- Verbose comments explaining obvious code
- Repetitive boilerplate not extracted to helpers
- Inconsistent style within the file
- Over-engineered solutions for simple problems
- Missing edge case handling despite looking complete
- Generic variable names (data, result, item, temp)

You MUST respond with ONLY valid JSON. No markdown, no explanation, just the JSON object.

Response format:
{
  "overallScore": <0-100 integer>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "detectedLanguage": <string>,
  "summary": <one paragraph summary>,
  "metrics": {
    "readability": <0-100>,
    "maintainability": <0-100>,
    "security": <0-100>,
    "complexity": <0-100>,
    "bestPractices": <0-100>
  },
  "issues": [
    {
      "severity": <"critical"|"warning"|"info">,
      "category": <string>,
      "message": <string>,
      "suggestion": <string>,
      "line": <number or null>
    }
  ],
  "strengths": [<string>, ...],
  "improvements": [<string>, ...],
  "aiGeneratedPatterns": [<string>, ...]
}`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { code, language, context, model } = parsed.data
    const resolvedModel = VALID_MODEL_IDS.includes(model) ? model : DEFAULT_JUDGE_MODEL

    const userPrompt = `${context ? `Context: ${context}\n\n` : ""}Language hint: ${language === "auto" ? "detect automatically" : language}

Code to analyze:
\`\`\`
${code}
\`\`\`

Analyze this code and return the JSON quality report.`

    const completion = await groq.chat.completions.create({
      model: resolvedModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ""
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()

    let result: CodeCheckResult
    try {
      result = JSON.parse(cleaned) as CodeCheckResult
    } catch {
      return Response.json({ error: "Failed to parse analysis result" }, { status: 500 })
    }

    // Clamp all scores 0-100
    result.overallScore = Math.max(0, Math.min(100, Math.round(result.overallScore)))
    for (const key of Object.keys(result.metrics) as Array<keyof typeof result.metrics>) {
      result.metrics[key] = Math.max(0, Math.min(100, Math.round(result.metrics[key])))
    }

    return Response.json(result)
  } catch (err) {
    console.error("POST /api/code-checker:", err)
    return Response.json({ error: "Analysis failed" }, { status: 500 })
  }
}
