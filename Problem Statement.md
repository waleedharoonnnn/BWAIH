# **Build with AI 2026 | Problem Statement**

Problem Statement Brief

**Submitted by:** Astera Software

## **01 · Company**

Astera Software

## **02 · Industry**

Data Integration, Enterprise Software, and AI Orchestration.

## **03 · Problem**

As AI agents evolve from basic chatbots into complex autonomous orchestrators, they rely on a fragile ecosystem of dynamic tools, custom functional skills, enterprise Knowledge Bases (RAG), and standardized interfaces such as Model Context Protocol (MCP) servers.

Today, evaluating whether an agent works correctly is heavily manual. Developers change a prompt, tweak a tool description, or alter an underlying schema, then run test queries by hand to see whether the result “feels” right. This lacks engineering rigor.

A small wording change in an MCP tool description can silently cause an LLM, whether Claude, a GPT variant, or an open-source model to misfire, hallucinate, or skip a vital step. We need a user-friendly, repeatable, and universally applicable framework to test AI agents like any other piece of deterministic software.

## **04 · Constraints**

* **Harness-agnostic.** The solution cannot be locked to a single platform. It must evaluate agents built on any harness or foundation-model architecture (e.g. Anthropic Claude, OpenAI, or custom internal runtime wrappers).

* **High user accessibility.** The interface must be straightforward enough for product managers, QA engineers, and developers to construct, organize, and execute test workflows without writing complex testing code from scratch.

* **Trace verification.** Testing the final text output is not enough. The system must inspect the execution path e.g. verifying that the agent called Tool\_A, processed the outcome, and correctly proceeded to Tool\_B.

## **05 · AI Angle**

The engine must balance two distinct paradigms of automated evaluation:

1. **Deterministic assertions**

Standard code checks that validate strict runtime parameters. Did the agent trigger the correct tool? Did it pass an integer to the API parameter? Was the execution path completed in under four steps? etc.

2. **Indeterministic / semantic evaluation**

Lightweight “LLM-as-a-Judge” metrics that score the fluid elements of a run. Is the retrieved RAG context relevant to the prompt? Does the final natural-language answer match the core intent of the golden dataset without hallucinating data?

*Note: You may tackle the evaluation from other angles as well.*

## **06 · Outcome**

A functional **Universal Agent Testing, Validation, and Scoring Dashboard** featuring:

* **Test Suite Builder.** A user-friendly space for constructing and organizing test cases. This might, for example, let a tester define a trigger prompt, an expected sequence of tool calls, and an optional golden response for semantic comparison but the exact inputs and structure are open to each team's design.

* **Execution Runner.** A mechanism for running test cases against a target agent and capturing what happens. One approach could be to connect to an agent API, dispatch the test payload, and monitor the multi-step execution loop, though teams are free to take this in whatever direction makes sense.

* **Report Card.** A clean reporting layout showing pass/fail states, the exact step where an agent went off the rails (e.g. calling an unintended tool), token-consumption variance, and semantic-drift scores etc.