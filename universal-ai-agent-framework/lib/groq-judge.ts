import Groq from "groq-sdk"
import type { SemanticJudgeResult } from "./types"
import { DEFAULT_JUDGE_MODEL } from "./groq-models"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function judgeSemanticSimilarity(
  goldenResponse: string,
  actualResponse: string,
  originalPrompt: string,
  model: string = DEFAULT_JUDGE_MODEL
): Promise<SemanticJudgeResult> {
  const systemPrompt = `You are a strict AI evaluation judge. Your job is to compare an agent's actual response against a golden (expected) response and score semantic similarity.

Scoring rules:
- 90-100: Near-identical meaning, all key facts present, no hallucinations
- 70-89: Most key information present, minor omissions, no hallucinations
- 50-69: Partially correct, some missing key info or slight inaccuracies
- 25-49: Significant misalignment, wrong focus, or notable inaccuracies
- 0-24: Completely off-topic, severely wrong, or heavy hallucination

Hallucination detection: Flag as hallucinated if the actual response contains specific facts, numbers, names, or claims NOT present in the golden response and not inferable from the prompt.

You MUST respond with ONLY valid JSON in this exact format, no markdown, no explanation:
{"score": <integer 0-100>, "reasoning": "<one sentence explanation>", "hallucinated": <true|false>}`

  const userPrompt = `Original prompt: ${originalPrompt}

Golden response: ${goldenResponse}

Actual response: ${actualResponse}

Evaluate and return JSON.`

  try {
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 300,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ""

    // Strip markdown fences, then try to extract the first {...} block
    const stripped = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()

    let parsed: SemanticJudgeResult | null = null

    // First attempt: direct parse
    try {
      parsed = JSON.parse(stripped) as SemanticJudgeResult
    } catch {
      // Second attempt: regex-extract the first JSON object from the string
      const match = stripped.match(/\{[\s\S]*?\}/)
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as SemanticJudgeResult
        } catch {
          // fall through to error return
        }
      }
    }

    if (!parsed || typeof parsed.score !== "number") {
      console.error("[groq-judge] Unparseable judge response:", raw)
      return {
        score: 0,
        reasoning: "Evaluation failed — judge returned an unreadable response",
        hallucinated: false,
      }
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      reasoning: parsed.reasoning ?? "No reasoning provided",
      hallucinated: Boolean(parsed.hallucinated),
    }
  } catch (err) {
    // If the selected model is decommissioned, silently retry with the default
    const isDecommissioned =
      err instanceof Error && err.message.includes("model_decommissioned")
    if (isDecommissioned && model !== DEFAULT_JUDGE_MODEL) {
      console.warn(`[groq-judge] Model "${model}" is decommissioned — retrying with ${DEFAULT_JUDGE_MODEL}`)
      return judgeSemanticSimilarity(goldenResponse, actualResponse, originalPrompt, DEFAULT_JUDGE_MODEL)
    }
    console.error("[groq-judge] API or execution error:", err)
    return {
      score: 0,
      reasoning: `Evaluation failed — ${err instanceof Error ? err.message : "unknown error"}`,
      hallucinated: false,
    }
  }
}
