import { settings } from '../settings.js'
import { runCli } from './spawn-util.js'
import type { AiProvider } from './provider-types.js'

/**
 * Codex CLI adapter (`@openai/codex`). Binary: `codex`. Non-interactive
 * invocation is `codex exec` — the `-` sentinel means "read the entire prompt
 * from stdin", which is what we want for long article bodies.
 *
 * Auth: `OPENAI_API_KEY` env var OR a prior `codex login` session. We inherit
 * the user's shell auth — no API key is stored by Guignol.
 */
export const codexProvider: AiProvider = {
  name: 'codex',
  run(prompt, timeoutMs) {
    // TODO (user contribution, learning mode): argv-vs-stdin trade-off for
    // Codex. Options:
    //
    //   A) argv prompt:    args: ['exec', prompt]              stdinPrompt: undefined
    //   B) stdin (default): args: ['exec', '-']                 stdinPrompt: prompt
    //   C) with schema:    args: ['exec', '-', '--output-schema', schemaPath]
    //                      (only if you want Codex's own JSON envelope layered
    //                       on top of the shared JSON contract — probably not)
    return runCli({
      bin: settings.get('codexBinary'),
      args: ['exec', '-'],
      stdinPrompt: prompt,
      timeoutMs,
      providerName: 'Codex'
    })
  }
}
