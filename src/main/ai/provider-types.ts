import type { AiProviderName } from '../../shared/types.js'

export interface AiProvider {
  readonly name: AiProviderName
  /** Returns raw stdout from the CLI (trimmed). Parsing happens in runAi(). */
  run(prompt: string, timeoutMs: number): Promise<string>
}
