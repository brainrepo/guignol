import { settings } from '../settings.js'
import { runCli } from './spawn-util.js'
import type { AiProvider } from './provider-types.js'

/**
 * Claude CLI adapter. Spawns `claude -p` with the prompt piped via stdin.
 * This avoids argv length/escape limits for long article bodies.
 * Binary path is user-configurable (settings.claudeBinary, default: "claude").
 */
export const claudeProvider: AiProvider = {
  name: 'claude',
  run(prompt, timeoutMs) {
    return runCli({
      bin: settings.get('claudeBinary'),
      args: ['-p'],
      stdinPrompt: prompt,
      timeoutMs,
      providerName: 'Claude'
    })
  }
}
