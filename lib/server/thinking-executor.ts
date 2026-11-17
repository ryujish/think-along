import { cliConnectionGuide, generateThinking, type GenerateThinkingInput } from './ai';
import { providerCli } from './cli-runtime.mjs';
import { relayThinkingViaRunner } from './think-relay.mjs';

// Local CLI first; a paired runner only when this machine has no CLI at all.
// A local execution failure never falls through to the runner — it is
// reported as-is instead of being silently replaced.
export async function generateThinkingWithRelay(request: Request, input: GenerateThinkingInput) {
  try {
    return await generateThinking(input);
  } catch (error) {
    if ((error as { code?: string }).code !== 'CLI_NOT_INSTALLED') throw error;
    const cli = (providerCli as Record<string, string>)[input.provider];
    try {
      return await relayThinkingViaRunner({ request, cli, prompt: input.prompt, context: input.context });
    } catch (relayError) {
      const status = (relayError as { status?: number }).status;
      if (status === 401 || status === 503) throw new Error(cliConnectionGuide(input.provider));
      throw relayError;
    }
  }
}

export function relayStatusOf(error: unknown, fallback = 502) {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 600 ? status : fallback;
}
