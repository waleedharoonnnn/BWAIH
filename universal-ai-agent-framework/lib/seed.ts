import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./db/schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const MOCK_AGENT_URL = "http://localhost:3000/api/mock-agent"
const FAILING_AGENT_URL = "http://localhost:3000/api/mock-agent?mode=fail"

async function seed() {
  console.log("🌱 Seeding database...")

  // ── Suite 1: RAG Search Agent ──────────────────────────────────────────────
  const [suite1] = await db
    .insert(schema.testSuites)
    .values({
      name: "RAG Search Agent",
      description: "Tests for an agent that uses RAG to answer knowledge-base questions",
      agentUrl: MOCK_AGENT_URL,
      agentAuthKey: null,
    })
    .returning()

  const suite1Cases = await db
    .insert(schema.testCases)
    .values([
      {
        suiteId: suite1.id,
        name: "Basic knowledge lookup",
        triggerPrompt: "Search and find information about our Q3 product roadmap",
        expectedToolSequence: ["search_knowledge_base", "retrieve_documents", "generate_response"],
        goldenResponse: "Based on the retrieved documents, the Q3 product roadmap includes new features for the analytics dashboard and improved API integrations. The team is focused on performance improvements and shipping three major features.",
        assertions: [
          { type: "tool_called", value: "search_knowledge_base", description: "Must search the knowledge base" },
          { type: "tool_called", value: "generate_response", description: "Must generate a final response" },
          { type: "step_limit", value: 5, description: "Should complete within 5 steps" },
        ],
      },
      {
        suiteId: suite1.id,
        name: "Document retrieval and summarization",
        triggerPrompt: "Retrieve documents about customer onboarding and summarize the key steps",
        expectedToolSequence: ["retrieve_documents", "summarize_text", "generate_response"],
        goldenResponse: "The customer onboarding process involves three key phases: account setup (days 1-3), product training (days 4-7), and go-live support (days 8-14). Each phase has dedicated resources and success criteria.",
        assertions: [
          { type: "tool_called", value: "retrieve_documents", description: "Must retrieve documents" },
          { type: "tool_called", value: "summarize_text", description: "Must summarize retrieved content" },
          { type: "step_limit", value: 4, description: "Should complete within 4 steps" },
          { type: "output_not_contains", value: "I don't know", description: "Should not admit ignorance" },
        ],
      },
      {
        suiteId: suite1.id,
        name: "Intent classification",
        triggerPrompt: "Classify the user intent for this query: what is our refund policy?",
        expectedToolSequence: ["classify_intent", "search_knowledge_base", "generate_response"],
        goldenResponse: "The user's intent is classified as 'policy inquiry'. Our refund policy allows returns within 30 days of purchase with a full refund, provided the item is in original condition.",
        assertions: [
          { type: "tool_called", value: "classify_intent", description: "Must classify intent first" },
          { type: "tool_order", value: ["classify_intent"], description: "Intent classification must come first" },
          { type: "step_limit", value: 5, description: "Should complete within 5 steps" },
        ],
      },
      {
        suiteId: suite1.id,
        name: "Multi-step research query",
        triggerPrompt: "Search for all documents related to API integration, retrieve the most relevant ones, and provide a comprehensive summary",
        expectedToolSequence: ["search_knowledge_base", "retrieve_documents", "summarize_text", "generate_response"],
        goldenResponse: "After searching and retrieving 3 relevant documents, the key API integration points are: REST endpoints for data ingestion, webhook support for real-time updates, and OAuth 2.0 authentication. The documentation covers rate limits and error handling.",
        assertions: [
          { type: "tool_called", value: "search_knowledge_base", description: "Must search KB" },
          { type: "tool_called", value: "retrieve_documents", description: "Must retrieve docs" },
          { type: "step_limit", value: 6, description: "Should complete within 6 steps" },
          { type: "output_contains", value: "API", description: "Response must mention API" },
        ],
      },
      {
        suiteId: suite1.id,
        name: "Validation and format check",
        triggerPrompt: "Validate and format the user input query before searching the knowledge base",
        expectedToolSequence: ["validate_input", "search_knowledge_base", "format_output"],
        goldenResponse: "Input validation passed. The query was sanitized and formatted. The knowledge base returned 4 relevant results which have been formatted according to the response schema.",
        assertions: [
          { type: "tool_called", value: "validate_input", description: "Must validate input" },
          { type: "tool_called", value: "format_output", description: "Must format output" },
          { type: "step_limit", value: 4, description: "Should complete within 4 steps" },
        ],
      },
    ])
    .returning()

  console.log(`  ✅ Suite 1 created with ${suite1Cases.length} test cases`)

  // ── Suite 2: Classification & Routing Agent ────────────────────────────────
  const [suite2] = await db
    .insert(schema.testSuites)
    .values({
      name: "Classification & Routing Agent",
      description: "Tests for an agent that classifies requests and routes to external APIs",
      agentUrl: FAILING_AGENT_URL,
      agentAuthKey: null,
    })
    .returning()

  const suite2Cases = await db
    .insert(schema.testCases)
    .values([
      {
        suiteId: suite2.id,
        name: "Support ticket classification",
        triggerPrompt: "Classify this support ticket and route it to the correct team: user cannot login",
        expectedToolSequence: ["classify_intent", "call_external_api", "generate_response"],
        goldenResponse: "Ticket classified as 'authentication issue' with high priority. Routed to the security team. The user should reset their password and enable 2FA. Estimated resolution time: 2 hours.",
        assertions: [
          { type: "tool_called", value: "classify_intent", description: "Must classify the ticket" },
          { type: "tool_called", value: "call_external_api", description: "Must call routing API" },
          { type: "step_limit", value: 4, description: "Should complete within 4 steps" },
        ],
      },
      {
        suiteId: suite2.id,
        name: "API data enrichment",
        triggerPrompt: "Call the external API to fetch user data and enrich the response",
        expectedToolSequence: ["validate_input", "call_external_api", "format_output", "generate_response"],
        goldenResponse: "Successfully fetched user profile data from the external API. The enriched data includes: account age (2.3 years), subscription tier (Professional), and last activity (2 days ago).",
        assertions: [
          { type: "tool_called", value: "call_external_api", description: "Must call external API" },
          { type: "step_limit", value: 5, description: "Should complete within 5 steps" },
          { type: "output_not_contains", value: "error", description: "Should not mention errors" },
        ],
      },
      {
        suiteId: suite2.id,
        name: "Intent routing with validation",
        triggerPrompt: "Validate and classify the user query then route to appropriate API endpoint",
        expectedToolSequence: ["validate_input", "classify_intent", "call_external_api"],
        goldenResponse: "Query validated successfully. Intent classified as 'data_request'. Routed to the analytics API endpoint. Response received with 156 data points for the requested time period.",
        assertions: [
          { type: "tool_called", value: "validate_input", description: "Must validate first" },
          { type: "tool_order", value: ["validate_input", "classify_intent"], description: "Validate before classify" },
          { type: "step_limit", value: 5, description: "Should complete within 5 steps" },
        ],
      },
      {
        suiteId: suite2.id,
        name: "Batch classification task",
        triggerPrompt: "Classify multiple intents from the incoming batch query request",
        expectedToolSequence: ["classify_intent", "format_output", "generate_response"],
        goldenResponse: "Batch classification complete. 12 queries processed: 45% product questions, 30% support requests, 15% billing inquiries, 10% feature requests. All routed appropriately.",
        assertions: [
          { type: "tool_called", value: "classify_intent", description: "Must classify" },
          { type: "step_limit", value: 4, description: "Should complete within 4 steps" },
        ],
      },
      {
        suiteId: suite2.id,
        name: "Error handling verification",
        triggerPrompt: "Handle the case where external API returns an error during the routing process",
        expectedToolSequence: ["validate_input", "call_external_api", "generate_response"],
        goldenResponse: "External API returned a 503 error. Applied fallback routing logic. Request queued for retry in 5 minutes. User notified with ticket ID #ERR-2847 for tracking.",
        assertions: [
          { type: "tool_called", value: "call_external_api", description: "Must attempt API call" },
          { type: "step_limit", value: 5, description: "Should complete within 5 steps" },
          { type: "output_contains", value: "error", description: "Response should acknowledge error" },
        ],
      },
    ])
    .returning()

  console.log(`  ✅ Suite 2 created with ${suite2Cases.length} test cases`)

  // ── Pre-run results for Suite 1 ────────────────────────────────────────────
  const [run1] = await db
    .insert(schema.testRuns)
    .values({
      suiteId: suite1.id,
      status: "completed",
      passCount: 4,
      failCount: 1,
      startedAt: new Date(Date.now() - 3600_000),
      completedAt: new Date(Date.now() - 3540_000),
    })
    .returning()

  const run1Results = suite1Cases.map((tc, i) => ({
    runId: run1.id,
    testCaseId: tc.id,
    passed: i !== 2,
    actualToolSequence: i === 2
      ? ["call_external_api", "generate_response"]
      : (tc.expectedToolSequence as string[]),
    tokenUsage: 200 + i * 50,
    stepCount: (tc.expectedToolSequence as string[])?.length ?? 3,
    rawResponse: i === 2
      ? "I was unable to classify the intent properly due to missing context."
      : "Based on the retrieved context and analysis, here is a comprehensive answer...",
    semanticScore: i === 2 ? 32 : [88, 91, 32, 79, 85][i],
    failureReason: i === 2 ? "Tool 'classify_intent' was not called" : null,
    assertionResults: null,
    trace: (tc.expectedToolSequence as string[] ?? ["generate_response"]).map((tool, j) => ({
      step: j + 1,
      tool,
      params: { input: tc.triggerPrompt.slice(0, 40) },
      result: "success",
      timestamp: Date.now() - (suite1Cases.length - j) * 1000,
    })),
  }))

  await db.insert(schema.testResults).values(run1Results)
  console.log(`  ✅ Run 1 created with ${run1Results.length} results`)

  // ── Pre-run results for Suite 2 ────────────────────────────────────────────
  const [run2] = await db
    .insert(schema.testRuns)
    .values({
      suiteId: suite2.id,
      status: "completed",
      passCount: 2,
      failCount: 3,
      startedAt: new Date(Date.now() - 1800_000),
      completedAt: new Date(Date.now() - 1740_000),
    })
    .returning()

  const run2Results = suite2Cases.map((tc, i) => ({
    runId: run2.id,
    testCaseId: tc.id,
    passed: i < 2,
    actualToolSequence: ["classify_intent", "call_external_api", "validate_input"],
    tokenUsage: 300 + i * 40,
    stepCount: 3,
    rawResponse: i < 2
      ? "Successfully processed request via classification and routing."
      : "I encountered an issue: the classification step failed to identify the correct intent.",
    semanticScore: i < 2 ? [76, 82][i] : [28, 41, 35][i - 2],
    failureReason: i >= 2 ? "Wrong tool sequence — expected validate_input first" : null,
    assertionResults: null,
    trace: ["classify_intent", "call_external_api", "validate_input"].map((tool, j) => ({
      step: j + 1,
      tool,
      params: { input: tc.triggerPrompt.slice(0, 40) },
      result: j < 2 ? "success" : "failed",
      timestamp: Date.now() - (3 - j) * 1000,
    })),
  }))

  await db.insert(schema.testResults).values(run2Results)
  console.log(`  ✅ Run 2 created with ${run2Results.length} results`)

  console.log("\n✨ Seed complete!")
  console.log(`   Suite 1 (RAG Search Agent): ${suite1Cases.length} cases, Run 1: 4 passed / 1 failed`)
  console.log(`   Suite 2 (Classification Agent): ${suite2Cases.length} cases, Run 2: 2 passed / 3 failed`)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
