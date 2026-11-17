import type { AiProvider, ContextPacket, ModelCapability, ProviderCatalogItem, ProviderId } from '@/lib/types';
import { authenticationState, runtimeMode } from './cli-profile.mjs';
import {
  CLI_RUNTIMES as CLI_RUNTIMES_RAW,
  cliSetupGuide,
  generateThinkingViaCli,
  getLocalCliStatuses,
  providerCli,
} from './cli-runtime.mjs';

type CliRuntimeMeta = { id: string; provider: AiProvider; name: string; vendor: string };
const CLI_RUNTIMES = CLI_RUNTIMES_RAW as unknown as CliRuntimeMeta[];

export type GenerateThinkingInput = {
  prompt: string;
  provider: AiProvider;
  context: ContextPacket;
  model?: string;
  connectionId?: string;
  userId?: string;
};

export type AiResult = {
  title: string;
  answer: string;
  insight: string;
  tags: string[];
};

export type AiProviderStatus = {
  provider: AiProvider;
  cli: string;
  connected: boolean;
  version: string;
};

export type RunnerCliStatus = {
  deviceId: string;
  deviceName: string;
  online: boolean;
  clis: Array<{ id: string; available: boolean; version: string }>;
};

const providerIds: Record<string, ProviderId> = { GPT: 'openai', Claude: 'anthropic', Gemini: 'gemini', 'Muse Code': 'meta' };
const defaultModels: ModelCapability[] = [{ id: 'default', text: true }];

export const CLI_BACKED_PROVIDERS: AiProvider[] = CLI_RUNTIMES.map((runtime: { provider: AiProvider }) => runtime.provider);

export function isCliBackedProvider(provider: AiProvider) {
  return CLI_BACKED_PROVIDERS.includes(provider);
}

export function getProviderCatalog(): ProviderCatalogItem[] {
  return CLI_RUNTIMES.map((runtime: { id: string; provider: AiProvider; name: string; vendor: string }) => ({
    id: providerIds[runtime.provider],
    label: runtime.provider,
    connections: [{
      id: `cli:${runtime.id}`,
      provider: providerIds[runtime.provider],
      name: `${runtime.name} 구독 로그인`,
      authKind: 'cli',
      credentialRef: `cli:${runtime.id}`,
      status: 'unknown',
      models: defaultModels,
    }],
  }));
}

export async function getAiProviderStatuses(userId?: string): Promise<AiProviderStatus[]> {
  const probed = await getLocalCliStatuses();
  return Promise.all(CLI_RUNTIMES.map(async (runtime: { id: string; provider: AiProvider }) => {
    const found = (probed as Array<{ id: string; installed: boolean; version: string }>).find((item) => item.id === runtime.id);
    const auth = runtimeMode() === 'server' ? await authenticationState(userId, runtime.id) : { authenticated: false };
    return { provider: runtime.provider, cli: runtime.id, installed: found?.installed === true,
      connected: found?.installed === true && (runtimeMode() === 'local' || auth.authenticated === true),
      authenticated: auth.authenticated === true, runtime: runtimeMode(), version: found?.version ?? '' };
  }));
}

function requireCli(provider: AiProvider): string {
  const cli = (providerCli as Record<string, string>)[provider];
  if (!cli) {
    throw new Error(
      `${provider}는 구독 CLI 연결을 지원하지 않습니다. Codex·agy·Muse Code·Claude 중 로그인된 CLI를 선택해주세요. 기존 대화 내용은 그대로 보관됩니다.`,
    );
  }
  return cli;
}

export function resolveProviderSelection(provider: AiProvider, connectionId?: string, model?: string) {
  const cli = requireCli(provider);
  return {
    provider,
    connectionId: connectionId?.trim() === `runner:${cli}` ? `runner:${cli}` : `cli:${cli}`,
    model: model?.trim() || 'default',
  };
}

export async function generateThinking(input: GenerateThinkingInput): Promise<AiResult> {
  const cli = requireCli(input.provider);
  try {
    return await generateThinkingViaCli({ cli, prompt: input.prompt, context: input.context, userId: input.userId });
  } catch (error) {
    if ((error as { code?: string }).code === 'CLI_NOT_INSTALLED') throw error;
    if (error instanceof Error) throw error;
    throw new Error(`${input.provider} CLI 실행에 실패했습니다.`);
  }
}

export function cliConnectionGuide(provider: AiProvider) {
  return cliSetupGuide(provider);
}
