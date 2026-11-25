import { pgTable, uuid, text, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core"

export const testSuites = pgTable("test_suites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  agentUrl: text("agent_url").notNull(),
  agentAuthKey: text("agent_auth_key"),
  judgeModel: text("judge_model").default("openai/gpt-oss-20b"),
  repeatCount: integer("repeat_count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
})

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id").references(() => testSuites.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  triggerPrompt: text("trigger_prompt").notNull(),
  expectedToolSequence: jsonb("expected_tool_sequence").$type<string[]>(),
  goldenResponse: text("golden_response"),
  assertions: jsonb("assertions").$type<Assertion[]>(),
  createdAt: timestamp("created_at").defaultNow(),
})

export const testRuns = pgTable("test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id").references(() => testSuites.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default("running"),
  agentUrl: text("agent_url"),
  repeatCount: integer("repeat_count").notNull().default(1),
  passCount: integer("pass_count").default(0),
  failCount: integer("fail_count").default(0),
  flakyCount: integer("flaky_count").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
})

export const testResults = pgTable("test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => testRuns.id, { onDelete: "cascade" }).notNull(),
  testCaseId: uuid("test_case_id").references(() => testCases.id, { onDelete: "cascade" }).notNull(),
  attempt: integer("attempt").notNull().default(1),
  passed: boolean("passed"),
  actualToolSequence: jsonb("actual_tool_sequence").$type<string[]>(),
  tokenUsage: integer("token_usage"),
  stepCount: integer("step_count"),
  rawResponse: text("raw_response"),
  semanticScore: integer("semantic_score"),
  judgeReasoning: text("judge_reasoning"),
  failureReason: text("failure_reason"),
  assertionResults: jsonb("assertion_results").$type<AssertionResult[]>(),
  trace: jsonb("trace").$type<TraceStep[]>(),
  createdAt: timestamp("created_at").defaultNow(),
})

export type Assertion = {
  type: "tool_called" | "tool_order" | "step_limit" | "param_type" | "output_contains" | "output_not_contains"
  value: string | number | string[]
  description: string
}

export type AssertionResult = {
  assertion: Assertion
  passed: boolean
  actual: string | number | null
  message: string
}

export type TraceStep = {
  step: number
  tool: string
  params: Record<string, unknown>
  result: string
  timestamp: number
}
