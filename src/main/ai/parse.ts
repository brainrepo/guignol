import type { AiResponse, AiResponseKind } from './schema.js'

export class AiParseError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message)
    this.name = 'AiParseError'
  }
}

/**
 * Parses a CLI's stdout into an AiResponse, per the shared JSON contract in
 * prompts.ts. See the TODO below — this is where provider robustness lives.
 *
 * Called from provider.ts → runAi() after each spawn resolves. Callers rely
 * on the returned `content` being safe to persist verbatim (frontmatter
 * `summary` field, or digest file body).
 *
 * @param raw   Trimmed stdout from any of the three CLIs.
 * @param kind  The kind the prompt asked for — used to validate the response.
 */
export function parseAiResponse(raw: string, kind: AiResponseKind): AiResponse {
  // TODO (user contribution, learning mode):
  //
  // Implement JSON extraction + validation. See plan for trade-offs between
  // strict / tolerant / multi-attempt strategies. Expected cases to handle:
  //
  //   1. Clean JSON: `{"kind": "summary", "content": "- bullet\\n- bullet"}`
  //   2. Fenced JSON: ` ```json\n{...}\n``` `
  //   3. Preamble:    `Here is the summary:\n{...}`
  //   4. Trailing text after the closing `}`
  //   5. Wrong kind field (prompt asked for summary, model returned digest)
  //   6. Missing `content` field — should throw AiParseError
  //
  // Return a valid AiResponse or throw AiParseError(msg, raw). The `raw`
  // argument is preserved on the error so callers can surface it in logs /
  // the UI for debugging prompt drift.
  //
  // Minimum required behavior for the scaffold to function — replace with a
  // real implementation:

  const stripped = stripFences(raw)
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new AiParseError('No JSON object found in provider output', raw)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped.slice(start, end + 1))
  } catch (err) {
    throw new AiParseError(`Failed to parse JSON: ${(err as Error).message}`, raw)
  }
  if (!isAiResponseShape(parsed)) {
    throw new AiParseError('Provider output did not match AiResponse shape', raw)
  }
  if (parsed.kind !== kind) {
    throw new AiParseError(`Expected kind "${kind}", got "${parsed.kind}"`, raw)
  }
  return parsed
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

function isAiResponseShape(v: unknown): v is AiResponse {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (o.kind === 'summary' || o.kind === 'digest') && typeof o.content === 'string'
}
