import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { testSuites, testCases } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { DEFAULT_JUDGE_MODEL, GROQ_MODELS } from "@/lib/groq-models"

export const runtime = "nodejs"

const VALID_MODEL_IDS = GROQ_MODELS.map((m) => m.id)

const createSuiteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  agentUrl: z.string().min(1, "Agent URL is required").refine(
    (v) => v.startsWith("/") || (() => { try { new URL(v); return true } catch { return false } })(),
    "Must be a valid URL or a relative path starting with /"
  ),
  agentAuthKey: z.string().optional(),
  judgeModel: z.string().optional(),
})

export async function GET() {
  try {
    const rows = await db
      .select({
        id: testSuites.id,
        name: testSuites.name,
        description: testSuites.description,
        agentUrl: testSuites.agentUrl,
        hasAuthKey: sql<boolean>`(${testSuites.agentAuthKey} is not null)`,
        judgeModel: testSuites.judgeModel,
        createdAt: testSuites.createdAt,
        testCaseCount: sql<number>`count(${testCases.id})::int`,
      })
      .from(testSuites)
      .leftJoin(testCases, eq(testCases.suiteId, testSuites.id))
      .groupBy(testSuites.id)
      .orderBy(testSuites.createdAt)

    return Response.json(rows)
  } catch (err) {
    console.error("GET /api/suites:", err)
    return Response.json({ error: "Failed to fetch suites" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createSuiteSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const resolvedModel = parsed.data.judgeModel && VALID_MODEL_IDS.includes(parsed.data.judgeModel)
      ? parsed.data.judgeModel
      : DEFAULT_JUDGE_MODEL

    const [suite] = await db
      .insert(testSuites)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        agentUrl: parsed.data.agentUrl,
        agentAuthKey: parsed.data.agentAuthKey ?? null,
        judgeModel: resolvedModel,
      })
      .returning()

    return Response.json(suite, { status: 201 })
  } catch (err) {
    console.error("POST /api/suites:", err)
    return Response.json({ error: "Failed to create suite" }, { status: 500 })
  }
}
