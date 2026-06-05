import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { applyPromptPlaceholders, getDocsSiteUrls, type DocsSiteUrls } from './docsSiteUrls';
import PromptCopyPre from './PromptCopyPre';

type TocItem = { id: string; text: string; level: number };

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-');
}

function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/\s+#*$/, '').trim();
    items.push({ id: slugify(text), text, level });
  }
  return items;
}

function PromptsEnvBanner({ urls }: { urls: DocsSiteUrls }) {
  return (
    <section className="prompts-env-banner surface-enter" aria-label="当前环境地址">
      <p className="prompts-env-banner-title">当前环境</p>
      <p className="prompts-env-banner-desc">
        下方提示词中的链接与 API 基址已根据你正在访问的站点自动填入；点击代码块右上角「复制」即可粘贴到 AI 对话。
      </p>
      <dl className="prompts-env-grid">
        <div>
          <dt>文档站</dt>
          <dd>
            <a href={urls.docsBase} target="_blank" rel="noreferrer">
              {urls.docsBase}
            </a>
          </dd>
        </div>
        <div>
          <dt>API 基址</dt>
          <dd>
            <a href={urls.apiBase} target="_blank" rel="noreferrer">
              {urls.apiBase}
            </a>
          </dd>
        </div>
        <div>
          <dt>OpenAPI</dt>
          <dd>
            <a href={urls.openapiUrl} target="_blank" rel="noreferrer">
              {urls.openapiUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt>应用首页</dt>
          <dd>
            <a href={urls.appUrl} target="_blank" rel="noreferrer">
              {urls.appUrl}
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default function PromptsGuide() {
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [error, setError] = useState<string | null>(null);
  const siteUrls = useMemo(() => getDocsSiteUrls(), []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}content/prompts-guide.md`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`加载失败 (${response.status})`);
        }
        return response.text();
      })
      .then(setRawMarkdown)
      .catch((err: Error) => setError(err.message));
  }, []);

  const markdown = useMemo(
    () => (rawMarkdown ? applyPromptPlaceholders(rawMarkdown, siteUrls) : ''),
    [rawMarkdown, siteUrls]
  );

  const toc = useMemo(() => extractToc(markdown), [markdown]);

  if (error) {
    return <div className="ai-guide-error">无法加载提示词参考：{error}</div>;
  }

  if (!markdown) {
    return <div className="ai-guide-loading">加载提示词参考…</div>;
  }

  return (
    <div className="ai-guide-layout">
      <aside className="ai-guide-toc" aria-label="目录">
        <p className="ai-guide-toc-title">目录</p>
        <ul>
          {toc.map((item) => (
            <li key={item.id} className={item.level === 3 ? 'level-3' : undefined}>
              <a href={`#${item.id}`}>{item.text}</a>
            </li>
          ))}
        </ul>
      </aside>
      <article className="ai-guide-content prose">
        <PromptsEnvBanner urls={siteUrls} />
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children, ...props }) => {
              const text = String(children);
              return (
                <h2 id={slugify(text)} {...props}>
                  {children}
                </h2>
              );
            },
            h3: ({ children, ...props }) => {
              const text = String(children);
              return (
                <h3 id={slugify(text)} {...props}>
                  {children}
                </h3>
              );
            },
            a: ({ href, children, ...props }) => {
              if (href?.startsWith('/')) {
                return (
                  <Link to={href} {...props}>
                    {children}
                  </Link>
                );
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" {...props}>
                  {children}
                </a>
              );
            },
            code: ({ className, children, ...props }) => {
              const isBlock = Boolean(className?.includes('language-'));
              if (isBlock) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code className="ai-guide-inline-code" {...props}>
                  {children}
                </code>
              );
            },
            pre: ({ children, ...props }) => <PromptCopyPre {...props}>{children}</PromptCopyPre>
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
