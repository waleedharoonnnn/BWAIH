import { NextRequest } from "next/server"
import { z } from "zod"
import { judgeSemanticSimilarity } from "@/lib/groq-judge"

export const runtime = "nodejs"

const evaluateSchema = z.object({
  goldenResponse: z.string().min(1),
  actualResponse: z.string().min(1),
  prompt: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = evaluateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const result = await judgeSemanticSimilarity(
      parsed.data.goldenResponse,
      parsed.data.actualResponse,
      parsed.data.prompt
    )

    return Response.json(result)
  } catch (err) {
    console.error("POST /api/evaluate:", err)
    return Response.json({ error: "Evaluation failed" }, { status: 500 })
  }
}
