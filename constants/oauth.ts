import * as Linking from "expo-linking";
import Constants from "expo-constants";
import * as ReactNative from "react-native";

const bundleId = "space.manus.ovr.vbt.coach.app.t20260125053732";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

const trimTrailingSlash = (url: string) => url.replace(/\/$/, "");
const unique = <T,>(values: T[]) => Array.from(new Set(values));

export type ApiHealthPayload = {
  ok: boolean;
  timestamp: number;
  port?: number;
  llm?: {
    configured: boolean;
    hasApiKey: boolean;
    model: string | null;
    apiBaseUrlConfigured: boolean;
  };
};

let resolvedApiBaseUrlCache = "";
let resolveApiBaseUrlPromise: Promise<string> | null = null;

const isLoopbackUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const extractHost = (candidate: string) =>
  candidate
    .replace(/^[a-z]+:\/\//i, "")
    .split("/")[0]
    .split(":")[0];

const withPorts = (protocol: string, host: string, ports: number[]) =>
  ports.map((port) => `${protocol}://${host}:${port}`);

const deriveNativeApiBaseCandidates = (): string[] => {
  const constants = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    manifest?: { debuggerHost?: string };
    manifest2?: {
      extra?: {
        expoClient?: { hostUri?: string };
        expoGo?: { debuggerHost?: string };
      };
    };
  };

  const hostCandidates = [
    constants.expoConfig?.hostUri,
    constants.manifest2?.extra?.expoClient?.hostUri,
    constants.manifest2?.extra?.expoGo?.debuggerHost,
    constants.manifest?.debuggerHost,
  ];

  for (const candidate of hostCandidates) {
    if (!candidate) continue;
    const host = extractHost(candidate);
    if (host) {
      return withPorts("http", host, [3000, 3001, 3002, 3003]);
    }
  }

  if (ReactNative.Platform.OS === "android") {
    return withPorts("http", "10.0.2.2", [3000, 3001, 3002, 3003]);
  }

  return withPorts("http", "127.0.0.1", [3000, 3001, 3002, 3003]);
};

const deriveWebApiBaseCandidates = (): string[] => {
  if (typeof window === "undefined" || !window.location) {
    return [];
  }

  const { protocol, hostname } = window.location;
  const prefixMatch = hostname.match(/^(\d+)-(.+)$/);
  if (prefixMatch) {
    const [, , suffix] = prefixMatch;
    return [3000, 3001, 3002, 3003].map((port) => `${protocol}//${port}-${suffix}`);
  }

  return [];
};

const deriveConfiguredApiBaseCandidates = (): string[] => {
  if (!API_BASE_URL) return [];
  const normalized = trimTrailingSlash(API_BASE_URL);

  if (ReactNative.Platform.OS !== "web" && isLoopbackUrl(normalized)) {
    return deriveNativeApiBaseCandidates();
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.port) {
      const basePort = parseInt(parsed.port, 10);
      if (Number.isFinite(basePort)) {
        return withPorts(parsed.protocol.replace(":", ""), parsed.hostname, [
          basePort,
          basePort + 1,
          basePort + 2,
          basePort + 3,
        ]);
      }
    }
  } catch {
    return [normalized];
  }

  return [normalized];
};

export function getApiBaseCandidates(): string[] {
  const configured = deriveConfiguredApiBaseCandidates();
  if (configured.length > 0) {
    return unique(configured.map(trimTrailingSlash));
  }

  if (ReactNative.Platform.OS === "web") {
    const webCandidates = deriveWebApiBaseCandidates();
    if (webCandidates.length > 0) {
      return unique(webCandidates.map(trimTrailingSlash));
    }
  }

  if (ReactNative.Platform.OS !== "web") {
    return unique(deriveNativeApiBaseCandidates().map(trimTrailingSlash));
  }

  return [];
}

const makeHealthUrl = (baseUrl: string) => `${trimTrailingSlash(baseUrl)}/api/health`;

async function fetchApiHealth(baseUrl: string): Promise<ApiHealthPayload | null> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 1200) : null;

  try {
    const response = await fetch(makeHealthUrl(baseUrl), {
      method: "GET",
      signal: controller?.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ApiHealthPayload;
  } catch {
    return null;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

const scoreApiHealth = (health: ApiHealthPayload | null) => {
  if (!health?.ok) return -1;

  let score = 1;
  if (health.llm?.configured) score += 3;
  if (health.llm?.hasApiKey) score += 5;
  if (health.llm?.apiBaseUrlConfigured) score += 2;
  if (health.llm?.model) score += 1;
  return score;
};

export async function resolveApiBaseUrl(force: boolean = false): Promise<string> {
  if (!force && resolvedApiBaseUrlCache) {
    return resolvedApiBaseUrlCache;
  }

  if (!force && resolveApiBaseUrlPromise) {
    return resolveApiBaseUrlPromise;
  }

  resolveApiBaseUrlPromise = (async () => {
    const candidates = getApiBaseCandidates();
    let bestCandidate = candidates[0] ?? "";
    let bestScore = -1;

    for (const candidate of candidates) {
      const health = await fetchApiHealth(candidate);
      const score = scoreApiHealth(health);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = trimTrailingSlash(candidate);
      }
    }

    resolvedApiBaseUrlCache = bestCandidate;
    return resolvedApiBaseUrlCache;
  })();

  try {
    return await resolveApiBaseUrlPromise;
  } finally {
    resolveApiBaseUrlPromise = null;
  }
}

export async function getResolvedApiHealth(force: boolean = false): Promise<{
  baseUrl: string;
  health: ApiHealthPayload | null;
}> {
  const baseUrl = await resolveApiBaseUrl(force);
  const health = baseUrl ? await fetchApiHealth(baseUrl) : null;
  return { baseUrl, health };
}

const isRequestLike = (input: RequestInfo | URL): input is Request =>
  typeof Request !== "undefined" && input instanceof Request;

const toUrlString = (input: RequestInfo | URL): string => {
  if (isRequestLike(input)) {
    return input.url;
  }
  return typeof input === "string" ? input : input.toString();
};

const toEndpointPath = (input: RequestInfo | URL): string => {
  const raw = toUrlString(input);
  try {
    const parsed = new URL(raw);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
};

export async function fetchWithApiFallback(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const endpointPath = toEndpointPath(input);
  const resolvedBaseUrl = resolvedApiBaseUrlCache || (await resolveApiBaseUrl());
  const candidates = unique([
    ...(resolvedBaseUrl ? [resolvedBaseUrl] : []),
    ...getApiBaseCandidates(),
  ]).filter(Boolean);

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const response = await fetch(`${trimTrailingSlash(candidate)}${endpointPath}`, init);
      resolvedApiBaseUrlCache = trimTrailingSlash(candidate);
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return fetch(input, init);
}

export function getApiBaseUrl(): string {
  if (resolvedApiBaseUrlCache) {
    return resolvedApiBaseUrlCache;
  }

  if (API_BASE_URL) {
    const normalized = trimTrailingSlash(API_BASE_URL);
    if (ReactNative.Platform.OS !== "web" && isLoopbackUrl(normalized)) {
      return deriveNativeApiBaseCandidates()[0] ?? normalized;
    }
    return normalized;
  }

  if (ReactNative.Platform.OS === "web") {
    const webCandidates = deriveWebApiBaseCandidates();
    if (webCandidates.length > 0) {
      return webCandidates[0];
    }
  }

  if (ReactNative.Platform.OS !== "web") {
    return deriveNativeApiBaseCandidates()[0] ?? "";
  }

  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  }
  return Linking.createURL("/oauth/callback", {
    scheme: env.deepLinkScheme,
  });
};

export const getLoginUrl = () => {
  const redirectUri = getRedirectUri();
  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = getLoginUrl();

  if (ReactNative.Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
  }

  return null;
}
