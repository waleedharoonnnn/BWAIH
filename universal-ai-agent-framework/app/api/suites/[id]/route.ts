import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { testSuites, testCases } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { GROQ_MODELS } from "@/lib/groq-models"

export const runtime = "nodejs"

const VALID_MODEL_IDS = GROQ_MODELS.map((m) => m.id)

const updateSuiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  agentUrl: z.string().min(1).refine(
    (v) => v.startsWith("/") || (() => { try { new URL(v); return true } catch { return false } })(),
    "Must be a valid URL or a relative path starting with /"
  ).optional(),
  agentAuthKey: z.string().optional().nullable(),
  judgeModel: z.string().refine((v) => VALID_MODEL_IDS.includes(v), "Invalid judge model").optional(),
})

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const [suite] = await db.select().from(testSuites).where(eq(testSuites.id, id))
    if (!suite) return Response.json({ error: "Suite not found" }, { status: 404 })

    const { agentAuthKey, ...suiteWithoutKey } = suite
    const cases = await db.select().from(testCases).where(eq(testCases.suiteId, id)).orderBy(testCases.createdAt)
    return Response.json({ ...suiteWithoutKey, hasAuthKey: agentAuthKey !== null, testCases: cases })
  } catch (err) {
    console.error("GET /api/suites/[id]:", err)
    return Response.json({ error: "Failed to fetch suite" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = updateSuiteSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [suite] = await db
      .update(testSuites)
      .set(parsed.data)
      .where(eq(testSuites.id, id))
      .returning()

    if (!suite) return Response.json({ error: "Suite not found" }, { status: 404 })
    const { agentAuthKey, ...suiteWithoutKey } = suite
    return Response.json({ ...suiteWithoutKey, hasAuthKey: agentAuthKey !== null })
  } catch (err) {
    console.error("PATCH /api/suites/[id]:", err)
    return Response.json({ error: "Failed to update suite" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const [deleted] = await db.delete(testSuites).where(eq(testSuites.id, id)).returning()
    if (!deleted) return Response.json({ error: "Suite not found" }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/suites/[id]:", err)
    return Response.json({ error: "Failed to delete suite" }, { status: 500 })
  }
}
