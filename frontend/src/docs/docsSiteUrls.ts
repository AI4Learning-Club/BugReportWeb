import { API_BASE } from '../api';

export type DocsSiteUrls = {
  siteOrigin: string;
  docsBase: string;
  apiBase: string;
  openapiUrl: string;
  docsApiRef: string;
  docsApiGuide: string;
  docsAiGuide: string;
  docsPrompts: string;
  appUrl: string;
};

function normalizeBasePath(baseUrl: string): string {
  if (!baseUrl || baseUrl === '/') {
    return '';
  }
  return baseUrl.replace(/\/$/, '');
}

export function getDocsSiteUrls(): DocsSiteUrls {
  const siteOrigin = window.location.origin;
  const basePath = normalizeBasePath(import.meta.env.BASE_URL || '/');
  const prefix = `${siteOrigin}${basePath}`;

  return {
    siteOrigin,
    docsBase: `${prefix}/docs`,
    apiBase: API_BASE,
    openapiUrl: `${prefix}/openapi.yaml`,
    docsApiRef: `${prefix}/docs`,
    docsApiGuide: `${prefix}/docs/api-guide`,
    docsAiGuide: `${prefix}/docs/ai-guide`,
    docsPrompts: `${prefix}/docs/prompts`,
    appUrl: prefix || siteOrigin
  };
}

/** 每段提示词开头的统一环境与文档链接块 */
export function formatPromptEnvBlock(urls: DocsSiteUrls): string {
  return [
    '【环境与文档】',
    `- 文档站：${urls.docsBase}`,
    `- API 基址：${urls.apiBase}`,
    `- OpenAPI：${urls.openapiUrl}`,
    `- API 使用指南：${urls.docsApiGuide}`,
    `- AI 代理指南：${urls.docsAiGuide}`,
    `- 提示词参考：${urls.docsPrompts}`,
    `- 应用首页：${urls.appUrl}`
  ].join('\n');
}

/** 将提示词 Markdown 中的占位符替换为当前站点完整 URL（便于复制到 AI 对话） */
export function applyPromptPlaceholders(markdown: string, urls: DocsSiteUrls): string {
  const replacements: Array<[string, string]> = [
    ['{{PROMPT_ENV_BLOCK}}', formatPromptEnvBlock(urls)],
    ['{{SITE_ORIGIN}}', urls.siteOrigin],
    ['{{DOCS_BASE}}', urls.docsBase],
    ['{{API_BASE}}', urls.apiBase],
    ['{API_BASE}', urls.apiBase],
    ['{{OPENAPI_URL}}', urls.openapiUrl],
    ['{{DOCS_API_REF}}', urls.docsApiRef],
    ['{{DOCS_API_GUIDE}}', urls.docsApiGuide],
    ['{{DOCS_AI_GUIDE}}', urls.docsAiGuide],
    ['{{DOCS_PROMPTS}}', urls.docsPrompts],
    ['{{APP_URL}}', urls.appUrl]
  ];

  let result = markdown;
  for (const [token, value] of replacements) {
    result = result.split(token).join(value);
  }
  return result;
}
