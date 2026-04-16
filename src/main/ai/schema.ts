/**
 * Shared response envelope across AI CLI providers (Claude, Codex).
 * Providers return `content` as markdown the caller persists verbatim:
 *   - `kind: 'summary'` → 3 bullets for article frontmatter.
 *   - `kind: 'digest'`  → thematic bullets + source links for a digest file.
 * The prompt (see prompts.ts) instructs the model to emit exactly one JSON
 * object matching this shape — per-provider native JSON modes are ignored
 * so parsing logic stays unified.
 */
export interface AiResponse {
  kind: 'summary' | 'digest'
  content: string
  model?: string
}

export type AiResponseKind = AiResponse['kind']
