# Demo Script

Live app: https://bwaih-three.vercel.app

## 1. The 30-second pitch

> "AI agents rely on tools, RAG and MCP servers. A one-line change to a tool description can silently break an agent, and today teams find out by eyeballing a few answers. AgentTest is **regression testing for AI agents**. You define what the agent should do, run it against any agent URL, and get a report card. It combines deterministic checks (right tool, right order, right parameter types, within N steps) with LLM-as-a-Judge semantic scoring. Because agents are non-deterministic, each test can run several times so you see a pass rate, not a coin flip."

## 2. What the demo runs against

The app includes a **real agent** at `/api/agent`. It is not a simulator:

- **Model:** Groq `openai/gpt-oss-120b` running a tool-calling loop.
- **Tools that call live public APIs:**
  - `search_wikipedia` (Wikipedia)
  - `get_weather` (Open-Meteo)
  - `convert_currency` (Frankfurter exchange rates)
  - `calculator`
  - `get_current_time`

There are two versions:

| URL | What it is |
|---|---|
| `/api/agent` (**v1**) | The original configuration. |
| `/api/agent?version=v2` | The **same model and tools**, after a "harmless cleanup": shorter tool descriptions, a shorter system prompt, and the `amount` parameter retyped as a string. |

v2 is the story: a small edit to an agent's configuration, the kind that gets made without a second thought.

## 3. Walkthrough (about 6 minutes)

1. **Dashboard.** Shows suite, test-case and run counts, the pass-rate trend and recent runs.
2. **Test Suites → Live Research Agent.** It has 6 test cases. Open **Multi-step: research then calculate** and point out its parts:
   - **trigger prompt:** what gets sent to the agent
   - **expected tool sequence:** `search_wikipedia → calculator`
   - **assertions:** tool order, parameter type, step limit
   - **golden response:** the reference answer for semantic scoring
3. **Edit the suite → set Runs per test = 2.** Explain that agents are non-deterministic, so one run proves little. Make sure the agent URL is **v1**.
4. **Run Suite.** Results stream live: every attempt, the tools it called, the assertions, and the semantic score. Expect 6/6 passing.
5. **The "harmless change".** Click **Edit** on the suite, then the **v2 — edited tool descriptions** button, then **Save**. Say: *"Someone tidied up the tool descriptions. Did anything break?"*
6. **Run Suite again.** Expect about 4/6 passing:
   - **Factual research** fails. v2 no longer looks things up; it answers from memory and has named the wrong designer of the Eiffel Tower. The report shows `Expected sequence: search_wikipedia, got: none`, along with the wrong answer next to the golden one.
   - **Currency conversion** fails with `Expected param "amount" … to be number, got string`, which the schema change caused.
7. **View Full Report → Compare with previous.** The banner reads **"2 tests regressed · the agent URL changed"**, with the pass rate going from 100% to 67% and score and token changes. Expand a regression to see A vs B side by side: the tools each version called and the answers each gave.
8. **Harness-agnostic.** Click **Edit** on a suite and paste any other agent URL. The runner sends `POST { prompt, input, message }` and recognizes these replies:
   - AgentTest JSON `{ response, trace, token_usage }`
   - OpenAI chat completions, including `tool_calls`
   - Anthropic messages, including `tool_use` blocks
   - LangChain `intermediate_steps`
   - plain text

The agent is non-deterministic, so exact results can vary between runs. If a v1 test fails or comes up flaky during the demo, use it: that is precisely what the reliability score is for.

## 4. Before presenting

- **Groq free tier limit.** The key allows 8,000 tokens per minute. A run of 6 tests × 2 attempts takes about 1–2 minutes. Use 2 runs per test on stage, not 5.
- **Rehearse once.** Run v1 and v2 once beforehand so the dashboard and Compare page have data. Then run them again live.
- **Warm the functions.** Open every page once beforehand.
