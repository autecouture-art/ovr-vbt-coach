import * as SecureStore from 'expo-secure-store';

const LOCAL_LLM_API_KEY = 'repvelo_local_llm_api_key';
const LOCAL_LLM_MODEL = 'repvelo_local_llm_model';
const LOCAL_LLM_API_URL = 'repvelo_local_llm_api_url';

export type LocalLLMConfig = {
  apiKey: string;
  model: string;
  apiUrl: string;
};

type CoachHistory = Array<{
  role: 'user' | 'coach';
  text: string;
}>;

type CoachContext = Record<string, unknown>;

const DEFAULT_MODEL = 'glm-4.7';
const DEFAULT_API_URL = 'https://api.z.ai/api/anthropic';
const DEFAULT_OPENAI_COMPAT_API_URL = 'https://api.z.ai/api/paas/v4';

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');
const getValue = async (key: string) => (await SecureStore.getItemAsync(key)) ?? '';

const isAnthropicEndpoint = (url: string) => /\/anthropic(\/|$)/i.test(url);

const getOpenAICompatUrl = (url: string) => {
  const normalized = trimTrailingSlash(url);
  if (isAnthropicEndpoint(normalized)) {
    return normalized.replace(/\/anthropic(\/)?$/i, '/paas/v4');
  }
  return normalized || DEFAULT_OPENAI_COMPAT_API_URL;
};

const parseError = (status: number, errorText: string) => {
  if (status === 401 && /invalid|authentication|api\s*key|unauthorized/i.test(errorText)) {
    return new Error('ZAI_API_KEY is invalid');
  }

  if (status === 429 && /insufficient balance|no resource package|recharge|quota|rate limit|too many requests/i.test(errorText)) {
    return new Error('ZAI_API_BALANCE_EXHAUSTED');
  }

  return new Error('LLM invoke failed: ' + status + ' ' + errorText);
};

const shouldFallbackFromAnthropic = (status: number, errorText: string) => {
  if (status === 400 || status === 404 || status === 405 || status === 415 || status === 422 || status >= 500) {
    return true;
  }
  return /unsupported|not found|invalid anthropic|unknown endpoint/i.test(errorText);
};

const parseAnthropicText = (data: { content?: Array<{ type: string; text?: string }> }) => {
  return (data.content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
};

const parseOpenAIText = (data: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type: string; text?: string }>;
    };
  }>;
}) => {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }
  return '';
};

const buildSystemPrompt = (context: CoachContext) => {
  const contextText = 'トレーニングコンテキスト(JSON):\n' + JSON.stringify(context, null, 2);
  return [
    'あなたは日本語のストレングスコーチです。短く具体的に答えてください。与えられたトレーニングデータを優先し、足りないときだけ不足点を1行で示してください。安全と回復を優先してください。',
    contextText,
  ].join('\n\n');
};

const normalizeHistoryMessages = (history: CoachHistory | undefined) => {
  const mapped: Array<{ role: 'user' | 'assistant'; content: string }> = (history ?? [])
    .map((item): { role: 'user' | 'assistant'; content: string } => ({
      role: item.role === 'coach' ? 'assistant' : 'user',
      content: item.text?.trim() ?? '',
    }))
    .filter((item) => item.content.length > 0);

  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const item of mapped) {
    const last = merged[merged.length - 1];
    if (last && last.role === item.role) {
      last.content = `${last.content}\n${item.content}`.trim();
      continue;
    }
    merged.push(item);
  }

  while (merged[0]?.role === 'assistant') {
    merged.shift();
  }

  return merged;
};

const buildHistoryMessages = (history: CoachHistory | undefined, message: string) => [
  ...normalizeHistoryMessages(history),
  {
    role: 'user',
    content: message.trim(),
  },
];

async function invokeAnthropic(params: {
  apiUrl: string;
  apiKey: string;
  model: string;
  system: string;
  history?: CoachHistory;
  message: string;
  maxTokens?: number;
}) {
  const response = await fetch(params.apiUrl + '/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.apiKey,
      authorization: 'Bearer ' + params.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 700,
      system: params.system,
      messages: buildHistoryMessages(params.history, params.message),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText) as Error & { status?: number; errorText?: string };
    error.status = response.status;
    error.errorText = errorText;
    throw error;
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  return parseAnthropicText(data);
}

async function invokeOpenAICompat(params: {
  apiUrl: string;
  apiKey: string;
  model: string;
  system: string;
  history?: CoachHistory;
  message: string;
  maxTokens?: number;
}) {
  const response = await fetch(params.apiUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + params.apiKey,
      'x-api-key': params.apiKey,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 700,
      thinking: { type: 'disabled' },
      messages: [
        { role: 'system', content: params.system },
        ...buildHistoryMessages(params.history, params.message),
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw parseError(response.status, errorText);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type: string; text?: string }>;
      };
    }>;
  };

  const text = parseOpenAIText(data);
  return text || '回答を生成できませんでした。';
}

export async function getLocalLLMConfig(): Promise<LocalLLMConfig> {
  const [apiKey, model, apiUrl] = await Promise.all([
    getValue(LOCAL_LLM_API_KEY),
    getValue(LOCAL_LLM_MODEL),
    getValue(LOCAL_LLM_API_URL),
  ]);

  return {
    apiKey: apiKey.trim(),
    model: model.trim() || DEFAULT_MODEL,
    apiUrl: trimTrailingSlash(apiUrl.trim() || DEFAULT_API_URL),
  };
}

export async function saveLocalLLMConfig(config: Partial<LocalLLMConfig>): Promise<void> {
  if (typeof config.apiKey === 'string') {
    const next = config.apiKey.trim();
    if (next) {
      await SecureStore.setItemAsync(LOCAL_LLM_API_KEY, next);
    } else {
      await SecureStore.deleteItemAsync(LOCAL_LLM_API_KEY);
    }
  }

  if (typeof config.model === 'string') {
    const next = config.model.trim() || DEFAULT_MODEL;
    await SecureStore.setItemAsync(LOCAL_LLM_MODEL, next);
  }

  if (typeof config.apiUrl === 'string') {
    const next = trimTrailingSlash(config.apiUrl.trim() || DEFAULT_API_URL);
    await SecureStore.setItemAsync(LOCAL_LLM_API_URL, next);
  }
}

export async function getLocalLLMHealth() {
  const config = await getLocalLLMConfig();
  return {
    ...config,
    hasApiKey: Boolean(config.apiKey),
    configured: Boolean(config.apiKey),
    isAnthropicCompatible: isAnthropicEndpoint(config.apiUrl),
  };
}

export async function invokeDirectCoachChat(params: {
  message: string;
  history?: CoachHistory;
  context?: CoachContext;
}): Promise<string> {
  const config = await getLocalLLMConfig();
  if (!config.apiKey) {
    throw new Error('ZAI_API_KEY is not configured');
  }

  const system = buildSystemPrompt(params.context ?? {});

  if (isAnthropicEndpoint(config.apiUrl)) {
    try {
      const text = await invokeAnthropic({
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        model: config.model,
        system,
        history: params.history,
        message: params.message,
      });
      if (text) {
        return text;
      }
    } catch (error) {
      const status = typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 0;
      const errorText = String((error as { errorText?: unknown }).errorText ?? (error as Error).message ?? '');

      if (!shouldFallbackFromAnthropic(status, errorText)) {
        throw parseError(status || 500, errorText);
      }
    }
  }

  return invokeOpenAICompat({
    apiUrl: getOpenAICompatUrl(config.apiUrl),
    apiKey: config.apiKey,
    model: config.model,
    system,
    history: params.history,
    message: params.message,
  });
}

export async function verifyLocalLLMConnection(): Promise<{
  ok: boolean;
  detail: string;
  model: string;
  apiUrl: string;
}> {
  const config = await getLocalLLMConfig();

  if (!config.apiKey) {
    return {
      ok: false,
      detail: 'ZAI APIキーが未設定です。',
      model: config.model,
      apiUrl: config.apiUrl,
    };
  }

  const system = '接続確認用です。「OK」のみ返答してください。';

  try {
    if (isAnthropicEndpoint(config.apiUrl)) {
      try {
        await invokeAnthropic({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          model: config.model,
          system,
          message: 'ping',
          maxTokens: 16,
        });
      } catch (error) {
        const status = typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status: number }).status
          : 0;
        const errorText = String((error as { errorText?: unknown }).errorText ?? (error as Error).message ?? '');

        if (!shouldFallbackFromAnthropic(status, errorText)) {
          throw parseError(status || 500, errorText);
        }

        await invokeOpenAICompat({
          apiUrl: getOpenAICompatUrl(config.apiUrl),
          apiKey: config.apiKey,
          model: config.model,
          system,
          message: 'ping',
          maxTokens: 16,
        });
      }
    } else {
      await invokeOpenAICompat({
        apiUrl: getOpenAICompatUrl(config.apiUrl),
        apiKey: config.apiKey,
        model: config.model,
        system,
        message: 'ping',
        maxTokens: 16,
      });
    }

    return {
      ok: true,
      detail: 'ローカル直接接続OK / model: ' + config.model,
      model: config.model,
      apiUrl: config.apiUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const detail = message.includes('ZAI_API_KEY is invalid')
      ? 'ZAI APIキーが無効です。'
      : message.includes('ZAI_API_BALANCE_EXHAUSTED')
        ? 'ZAI API の残高またはパッケージが不足しています。'
        : message.includes('fetch')
          ? '接続先に到達できません。'
          : 'ローカル直接接続に失敗: ' + message;

    return {
      ok: false,
      detail,
      model: config.model,
      apiUrl: config.apiUrl,
    };
  }
}
