import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { testCases } from "@/lib/db/schema"

export const runtime = "nodejs"

const assertionSchema = z.object({
  type: z.enum(["tool_called", "tool_order", "step_limit", "param_type", "output_contains", "output_not_contains"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  description: z.string(),
})

const createTestCaseSchema = z.object({
  suiteId: z.string().uuid("Invalid suite ID"),
  name: z.string().min(1).max(200),
  triggerPrompt: z.string().min(1),
  expectedToolSequence: z.array(z.string()).optional(),
  goldenResponse: z.string().optional(),
  assertions: z.array(assertionSchema).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createTestCaseSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [tc] = await db
      .insert(testCases)
      .values({
        suiteId: parsed.data.suiteId,
        name: parsed.data.name,
        triggerPrompt: parsed.data.triggerPrompt,
        expectedToolSequence: parsed.data.expectedToolSequence ?? null,
        goldenResponse: parsed.data.goldenResponse ?? null,
        assertions: parsed.data.assertions ?? null,
      })
      .returning()

    return Response.json(tc, { status: 201 })
  } catch (err) {
    console.error("POST /api/test-cases:", err)
    return Response.json({ error: "Failed to create test case" }, { status: 500 })
  }
}
