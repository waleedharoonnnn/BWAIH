import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { testRuns, testSuites } from "@/lib/db/schema"
import { eq, desc, sql } from "drizzle-orm"

export const runtime = "nodejs"

const createRunSchema = z.object({
  suiteId: z.string().uuid("Invalid suite ID"),
})

export async function GET() {
  try {
    const rows = await db
      .select({
        id: testRuns.id,
        suiteId: testRuns.suiteId,
        status: testRuns.status,
        passCount: testRuns.passCount,
        failCount: testRuns.failCount,
        startedAt: testRuns.startedAt,
        completedAt: testRuns.completedAt,
        suiteName: testSuites.name,
        totalTests: sql<number>`(${testRuns.passCount} + ${testRuns.failCount})::int`,
      })
      .from(testRuns)
      .leftJoin(testSuites, eq(testRuns.suiteId, testSuites.id))
      .orderBy(desc(testRuns.startedAt))
      .limit(50)

    return Response.json(rows)
  } catch (err) {
    console.error("GET /api/runs:", err)
    return Response.json({ error: "Failed to fetch runs" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createRunSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [suite] = await db.select().from(testSuites).where(eq(testSuites.id, parsed.data.suiteId))
    if (!suite) {
      return Response.json({ error: "Suite not found" }, { status: 404 })
    }

    const [run] = await db
      .insert(testRuns)
      .values({ suiteId: parsed.data.suiteId, status: "running" })
      .returning()

    return Response.json({ runId: run.id }, { status: 201 })
  } catch (err) {
    console.error("POST /api/runs:", err)
    return Response.json({ error: "Failed to create run" }, { status: 500 })
  }
}
