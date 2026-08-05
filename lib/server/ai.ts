import type { AiProvider } from '@/lib/types';

type GenerateThinkingInput = {
  prompt: string;
  provider: AiProvider;
  context?: string[];
  apiKey?: string;
  model?: string;
};

type AiResult = {
  title: string;
  answer: string;
  insight: string;
  tags: string[];
};

export type AiProviderStatus = {
  provider: AiProvider;
  connected: boolean;
  model: string;
  requiredEnv: string;
};

export function getAiProviderStatuses(): AiProviderStatus[] {
  return [
    {
      provider: 'GPT',
      connected: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      requiredEnv: 'OPENAI_API_KEY',
    },
    {
      provider: 'Claude',
      connected: Boolean(process.env.ANTHROPIC_API_KEY),
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      requiredEnv: 'ANTHROPIC_API_KEY',
    },
    {
      provider: 'Gemini',
      connected: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      requiredEnv: 'GEMINI_API_KEY',
    },
  ];
}

function localAiResult(input: GenerateThinkingInput): AiResult {
  const compactPrompt = input.prompt.trim().replace(/\s+/g, ' ');
  const title = compactPrompt.length > 24 ? `${compactPrompt.slice(0, 24)}...` : compactPrompt || '새 Thinking';
  const providerTone = {
    GPT: '실행 계획 중심',
    Claude: '맥락 분석 중심',
    Gemini: '자료 탐색 중심',
  }[input.provider];

  return {
    title,
    answer: `${providerTone}으로 정리했습니다. 핵심 문제를 정의하고, 현재 맥락을 바탕으로 다음 액션을 3단계로 나눕니다. 1) 목표와 제약을 명확히 하기 2) 선택 가능한 대안을 비교하기 3) 가장 작은 실험부터 실행하기.`,
    insight: `이 질문은 ${providerTone} 사고 패턴에 가깝습니다. 반복되면 장기 목표나 관심사 변화 분석에 반영됩니다.`,
    tags: ['AI', input.provider, 'Thinking'],
  };
}

function normalizeJsonText(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function parseOpenAiText(text: string, input: GenerateThinkingInput): AiResult {
  try {
    const parsed = JSON.parse(normalizeJsonText(text)) as Partial<AiResult>;
    return {
      title: parsed.title || localAiResult(input).title,
      answer: parsed.answer || text,
      insight: parsed.insight || 'AI가 질문의 핵심 패턴을 분석했습니다.',
      tags: parsed.tags?.length ? parsed.tags : ['AI', input.provider],
    };
  } catch {
    return {
      title: localAiResult(input).title,
      answer: text,
      insight: 'AI가 질문의 핵심 패턴을 분석했습니다.',
      tags: ['AI', input.provider],
    };
  }
}

export async function generateThinking(input: GenerateThinkingInput): Promise<AiResult> {
  if (input.provider === 'Claude') return generateWithClaude(input);
  if (input.provider === 'Gemini') return generateWithGemini(input);
  return generateWithOpenAi(input);
}

async function generateWithOpenAi(input: GenerateThinkingInput): Promise<AiResult> {
  const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return localAiResult(input);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You generate Think Along records. Return compact JSON with title, answer, insight, and tags. Korean output.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            prompt: input.prompt,
            context: input.context ?? [],
          }),
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
  });

  if (!response.ok) {
    if (input.apiKey) throw new Error('등록한 OpenAI API Key로 연결하지 못했습니다.');
    return localAiResult(input);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const text =
    data.output_text ??
    data.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text ??
    '';

  return text ? parseOpenAiText(text, input) : localAiResult(input);
}

async function generateWithClaude(input: GenerateThinkingInput): Promise<AiResult> {
  const apiKey = input.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return localAiResult(input);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 900,
      system:
        'You generate Think Along records. Return compact JSON with title, answer, insight, and tags. Korean output.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ prompt: input.prompt, context: input.context ?? [] }),
        },
      ],
    }),
  });

  if (!response.ok) {
    if (input.apiKey) throw new Error('등록한 Anthropic API Key로 연결하지 못했습니다.');
    return localAiResult(input);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.find((item) => item.text)?.text ?? '';
  return text ? parseOpenAiText(text, input) : localAiResult(input);
}

async function generateWithGemini(input: GenerateThinkingInput): Promise<AiResult> {
  const apiKey = input.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return localAiResult(input);

  const model = input.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'You generate Think Along records. Return compact JSON with title, answer, insight, and tags. Korean output.',
                  JSON.stringify({ prompt: input.prompt, context: input.context ?? [] }),
                ].join('\n'),
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    if (input.apiKey) throw new Error('등록한 Gemini API Key로 연결하지 못했습니다.');
    return localAiResult(input);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.find((item) => item.text)?.text ?? '';
  return text ? parseOpenAiText(text, input) : localAiResult(input);
}
