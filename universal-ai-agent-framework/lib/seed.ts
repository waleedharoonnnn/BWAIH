/**
 * Creates a demo suite that tests the built-in live agent (/api/agent).
 * Run with: npm run seed   (uses DATABASE_URL from .env.local; safe to re-run)
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq } from "drizzle-orm"
import * as schema from "./db/schema"

const db = drizzle(neon(process.env.DATABASE_URL!), { schema })

const SUITE_NAME = "Live Research Agent"

async function seed() {
  const existing = await db.select().from(schema.testSuites).where(eq(schema.testSuites.name, SUITE_NAME))
  if (existing.length > 0) {
    console.log(`Suite "${SUITE_NAME}" already exists — nothing to do.`)
    return
  }

  const [suite] = await db
    .insert(schema.testSuites)
    .values({
      name: SUITE_NAME,
      description: "Groq LLM agent with live tools: Wikipedia, weather, currency rates, calculator, clock",
      agentUrl: "/api/agent",
      agentAuthKey: process.env.AGENT_API_KEY ?? null,
    })
    .returning()

  const cases = await db
    .insert(schema.testCases)
    .values([
      {
        suiteId: suite.id,
        name: "Weather lookup",
        triggerPrompt: "What's the weather like in Lahore right now?",
        expectedToolSequence: ["get_weather"],
        goldenResponse: "The agent reports the current temperature and weather conditions in Lahore, Pakistan, based on live data.",
        assertions: [
          { type: "tool_called", value: "get_weather", description: "Must fetch live weather" },
          { type: "param_type", value: "get_weather:city:string", description: "City must be a string" },
          { type: "step_limit", value: 3, description: "Should finish within 3 tool calls" },
          { type: "output_contains", value: "Lahore", description: "Answer must name the city" },
        ],
      },
      {
        suiteId: suite.id,
        name: "Currency conversion",
        triggerPrompt: "Convert 250 US dollars to euros using today's rate.",
        expectedToolSequence: ["convert_currency"],
        goldenResponse: "250 USD converts to roughly 215–240 EUR at the latest exchange rate.",
        assertions: [
          { type: "tool_called", value: "convert_currency", description: "Must use the live rate" },
          { type: "param_type", value: "convert_currency:amount:number", description: "Amount must be passed as a number" },
          { type: "step_limit", value: 2, description: "One conversion call is enough" },
        ],
      },
      {
        suiteId: suite.id,
        name: "Factual research",
        triggerPrompt: "Who designed the Eiffel Tower and in what year was it completed?",
        expectedToolSequence: ["search_wikipedia"],
        goldenResponse: "The Eiffel Tower was designed by Gustave Eiffel's engineering company and completed in 1889 for the World's Fair in Paris.",
        assertions: [
          { type: "tool_called", value: "search_wikipedia", description: "Must research instead of guessing" },
          { type: "output_contains", value: "1889", description: "Must state the completion year" },
          { type: "step_limit", value: 4, description: "Should finish within 4 tool calls" },
        ],
      },
      {
        suiteId: suite.id,
        name: "Multi-step: research then calculate",
        triggerPrompt: "Look up the height of Mount Everest in meters, then calculate how many times taller it is than the Burj Khalifa (828 m).",
        expectedToolSequence: ["search_wikipedia", "calculator"],
        goldenResponse: "Mount Everest is about 8,849 m tall, which is roughly 10.7 times the height of the Burj Khalifa.",
        assertions: [
          { type: "tool_order", value: ["search_wikipedia", "calculator"], description: "Research must come before arithmetic" },
          { type: "param_type", value: "calculator:expression:string", description: "Expression must be a string" },
          { type: "step_limit", value: 5, description: "Should finish within 5 tool calls" },
        ],
      },
      {
        suiteId: suite.id,
        name: "Exact arithmetic",
        triggerPrompt: "What is (1234 * 5678) / 3? Give the answer to two decimal places.",
        expectedToolSequence: ["calculator"],
        goldenResponse: "(1234 × 5678) / 3 = 2,335,550.67",
        assertions: [
          { type: "tool_called", value: "calculator", description: "Must not do arithmetic in its head" },
          { type: "output_not_contains", value: "I cannot", description: "Should not refuse" },
        ],
      },
      {
        suiteId: suite.id,
        name: "Timezone lookup",
        triggerPrompt: "What time is it in Tokyo right now?",
        expectedToolSequence: ["get_current_time"],
        goldenResponse: "The agent states the current local date and time in Tokyo, Japan (Asia/Tokyo timezone).",
        assertions: [
          { type: "tool_called", value: "get_current_time", description: "Must check the real clock" },
          { type: "param_type", value: "get_current_time:timezone:string", description: "Timezone must be a string" },
          { type: "step_limit", value: 2, description: "One clock call is enough" },
        ],
      },
    ])
    .returning()

  console.log(`Created suite "${SUITE_NAME}" with ${cases.length} test cases (id: ${suite.id})`)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
