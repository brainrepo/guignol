import type { Article } from '../../shared/types.js'
import { settings } from '../settings.js'
import { log } from '../log.js'
import type { AiProvider } from './provider-types.js'
import type { AiResponse, AiResponseKind } from './schema.js'
import { parseAiResponse } from './parse.js'
import { buildSummaryPrompt } from './prompts.js'
import { claudeProvider } from './claude-cli.js'
import { codexProvider } from './codex-cli.js'

const PROVIDERS: Record<string, AiProvider> = {
  claude: claudeProvider,
  codex: codexProvider
}

export function getActiveProvider(): AiProvider {
  const name = settings.get('aiProvider')
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Unknown AI provider: ${name}`)
  return p
}

/**
 * Runs a prompt against the user's active provider and parses the response
 * per the shared JSON schema (see schema.ts + prompts.ts). Callers should
 * build the prompt via the helpers in prompts.ts so the output contract tail
 * is included.
 */
export async function runAi(
  prompt: string,
  timeoutMs: number,
  kind: AiResponseKind
): Promise<AiResponse> {
  const provider = getActiveProvider()
  log.info('ai', `invoking ${provider.name} (kind=${kind})`)
  const raw = await provider.run(prompt, timeoutMs)
  return parseAiResponse(raw, kind)
}

/**
 * Summarize an article with the active provider. Replaces the old
 * Claude-specific `summarize()` call site.
 */
export async function summarizeArticle(article: Article): Promise<AiResponse> {
  const prompt = buildSummaryPrompt(article, settings.get('language'))
  return await runAi(prompt, 30_000, 'summary')
}
