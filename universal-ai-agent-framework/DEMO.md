# Demo Script

Live app: https://bwaih-three.vercel.app

## 1. The 30-second pitch

> "AI agents rely on tools, RAG and MCP servers. Today, testing them is manual: you tweak a prompt and eyeball whether the output feels right. AgentTest is **Postman + Jest for AI agents**. You define what an agent *should* do, run it against any agent URL, and get a report card with deterministic checks (right tool, right order, right parameter types, within N steps) and LLM-as-a-Judge semantic scoring (does the answer match the intent, or did it hallucinate?)."

## 2. What the demo runs against

The app includes a **real agent** at `/api/agent`. It is not a simulator:

- **Model:** Groq `openai/gpt-oss-120b` running a tool-calling loop.
- **Tools that call live public APIs:**
  - `search_wikipedia` (Wikipedia)
  - `get_weather` (Open-Meteo)
  - `convert_currency` (Frankfurter exchange rates)
  - `calculator` (local parser)
  - `get_current_time`
- **Real data in the trace:** every tool call, its arguments, the API result and token usage.

The agent is non-deterministic, so a run can differ from the last one. That is the point: the framework catches it when the agent misbehaves.

## 3. Walkthrough (about 5 minutes)

1. **Dashboard.** Shows suite, test-case and run counts, the pass-rate trend and recent runs.
2. **Test Suites → Live Research Agent.** It has 6 test cases. Open **Multi-step: research then calculate** and point out its parts:
   - **trigger prompt:** what gets sent to the agent
   - **expected tool sequence:** `search_wikipedia → calculator`
   - **assertions:** tool order, parameter type, step limit
   - **golden response:** the reference answer for semantic scoring
3. **Run Suite.** Results stream live over SSE: the agent call, the captured trace, then assertions, then the semantic score, for each test.
4. **View Full Report.** Expand a result to show:
   - **Tool Sequence:** expected vs actual, side by side.
   - **Assertions:** each check passes or fails, showing the actual value.
   - **Semantic Analysis:** score from 0 to 100, the judge's reasoning, and golden vs actual response.
   - **Execution Trace:** every tool call with its parameters and the live API result.
5. **Show a failure being caught.** Add a test case to the suite:

   | Field | Value |
   |---|---|
   | Name | `Must not over-research` |
   | Trigger prompt | `Look up the height of Mount Everest, then calculate how many times taller it is than the Burj Khalifa (828 m).` |
   | Assertion | Step Limit = `1` |
   | Assertion | Tool Order = `calculator, search_wikipedia` |

   Run it. Both assertions fail, and the report says exactly why. For example: *"Expected sequence: calculator → search_wikipedia, got: search_wikipedia → calculator"*.
6. **Harness-agnostic.** Click **Edit** on a suite and paste any other agent URL. The runner sends `POST { prompt, input, message }` and recognizes these replies:
   - AgentTest JSON `{ response, trace, token_usage }`
   - OpenAI chat completions, including `tool_calls`
   - Anthropic messages, including `tool_use` blocks
   - LangChain `intermediate_steps`
   - plain text

## 4. Before presenting

- Open every page once so the serverless functions are warm.
- Run the suite once beforehand so the dashboard has data.
