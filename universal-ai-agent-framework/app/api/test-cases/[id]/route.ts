import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { testCases } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

const assertionSchema = z.object({
  type: z.enum(["tool_called", "tool_order", "step_limit", "param_type", "output_contains", "output_not_contains"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  description: z.string(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerPrompt: z.string().min(1).optional(),
  expectedToolSequence: z.array(z.string()).optional().nullable(),
  goldenResponse: z.string().optional().nullable(),
  assertions: z.array(assertionSchema).optional().nullable(),
})

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const [tc] = await db.select().from(testCases).where(eq(testCases.id, id))
    if (!tc) return Response.json({ error: "Test case not found" }, { status: 404 })
    return Response.json(tc)
  } catch (err) {
    console.error("GET /api/test-cases/[id]:", err)
    return Response.json({ error: "Failed to fetch test case" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [tc] = await db
      .update(testCases)
      .set(parsed.data)
      .where(eq(testCases.id, id))
      .returning()

    if (!tc) return Response.json({ error: "Test case not found" }, { status: 404 })
    return Response.json(tc)
  } catch (err) {
    console.error("PATCH /api/test-cases/[id]:", err)
    return Response.json({ error: "Failed to update test case" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const [deleted] = await db.delete(testCases).where(eq(testCases.id, id)).returning()
    if (!deleted) return Response.json({ error: "Test case not found" }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/test-cases/[id]:", err)
    return Response.json({ error: "Failed to delete test case" }, { status: 500 })
  }
}
