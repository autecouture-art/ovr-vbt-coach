const pick = (...values: Array<string | undefined>) =>
  values.find((value) => value && value.trim().length > 0) ?? "";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  zaiApiUrl: pick(
    process.env.ZAI_API_URL,
    process.env.ZHIPU_API_URL,
    process.env.BUILT_IN_ZAI_API_URL,
    process.env.VITE_FRONTEND_ZAI_API_URL,
    process.env.BUILT_IN_FORGE_API_URL,
    process.env.VITE_FRONTEND_FORGE_API_URL,
    process.env.FORGE_API_URL,
  ),
  zaiApiKey: pick(
    process.env.ZAI_API_KEY,
    process.env.ZHIPU_API_KEY,
    process.env.BUILT_IN_ZAI_API_KEY,
    process.env.VITE_FRONTEND_ZAI_API_KEY,
    process.env.BUILT_IN_FORGE_API_KEY,
    process.env.VITE_FRONTEND_FORGE_API_KEY,
    process.env.FORGE_API_KEY,
  ),
  zaiModel: pick(
    process.env.ZAI_MODEL,
    process.env.GLM_MODEL,
    process.env.LLM_MODEL,
  ),
  forgeApiUrl: "",
  forgeApiKey: "",
};

ENV.forgeApiUrl = ENV.zaiApiUrl;
ENV.forgeApiKey = ENV.zaiApiKey;
