import type { Assertion, AssertionResult, TraceStep } from "./db/schema"

type RunInput = {
  trace: TraceStep[]
  response: string
  stepCount: number
}

export function runAssertions(assertions: Assertion[], result: RunInput): AssertionResult[] {
  return assertions.map((assertion) => evaluate(assertion, result))
}

function evaluate(assertion: Assertion, result: RunInput): AssertionResult {
  const toolNames = result.trace.map((s) => s.tool)

  switch (assertion.type) {
    case "tool_called": {
      const tool = String(assertion.value)
      const called = toolNames.includes(tool)
      return {
        assertion,
        passed: called,
        actual: called ? tool : `not called (saw: ${toolNames.join(", ") || "none"})`,
        message: called
          ? `Tool "${tool}" was called`
          : `Expected tool "${tool}" to be called, but it was not`,
      }
    }

    case "tool_order": {
      const expected = Array.isArray(assertion.value) ? assertion.value : [String(assertion.value)]
      const actual = toolNames
      // In-order subsequence: A must be called before B, other tools may be interleaved.
      let cursor = 0
      for (const tool of actual) if (tool === expected[cursor]) cursor++
      const matched = cursor === expected.length
      return {
        assertion,
        passed: matched,
        actual: actual.join(" → "),
        message: matched
          ? `Tool sequence matched: ${expected.join(" → ")}`
          : `Expected sequence: ${expected.join(" → ")}, got: ${actual.join(" → ") || "none"} — "${expected[cursor]}" missing or out of order`,
      }
    }

    case "step_limit": {
      const limit = Number(assertion.value)
      const passed = result.stepCount <= limit
      return {
        assertion,
        passed,
        actual: result.stepCount,
        message: passed
          ? `Completed in ${result.stepCount} steps (limit: ${limit})`
          : `Exceeded step limit: ${result.stepCount} steps (limit: ${limit})`,
      }
    }

    case "param_type": {
      const [toolName, paramName, expectedType] = String(assertion.value).split(":")
      const step = result.trace.find((s) => s.tool === toolName)
      if (!step) {
        return {
          assertion,
          passed: false,
          actual: null,
          message: `Tool "${toolName}" was not called, cannot check param type`,
        }
      }
      const paramValue = step.params[paramName]
      const actualType = paramValue === null ? "null" : Array.isArray(paramValue) ? "array" : typeof paramValue
      const passed = actualType === expectedType
      return {
        assertion,
        passed,
        actual: actualType,
        message: passed
          ? `Param "${paramName}" on "${toolName}" is ${actualType} as expected`
          : `Expected param "${paramName}" on "${toolName}" to be ${expectedType}, got ${actualType}`,
      }
    }

    case "output_contains": {
      const needle = String(assertion.value)
      const passed = result.response.toLowerCase().includes(needle.toLowerCase())
      return {
        assertion,
        passed,
        actual: passed ? needle : `"${needle}" not found`,
        message: passed
          ? `Response contains "${needle}"`
          : `Response does not contain "${needle}"`,
      }
    }

    case "output_not_contains": {
      const needle = String(assertion.value)
      const passed = !result.response.toLowerCase().includes(needle.toLowerCase())
      return {
        assertion,
        passed,
        actual: passed ? "not present" : `"${needle}" found`,
        message: passed
          ? `Response correctly does not contain "${needle}"`
          : `Response should not contain "${needle}", but it does`,
      }
    }

    default: {
      return {
        assertion,
        passed: false,
        actual: null,
        message: `Unknown assertion type: ${(assertion as Assertion).type}`,
      }
    }
  }
}
