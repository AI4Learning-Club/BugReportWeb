import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { API_BASE } from '../api';
import { PERMISSION_DOCS, permissionLabel } from './permissionDocs';
import { formatJson, parseOpenApiDocument, type ParsedOpenApi, type ParsedOperation } from './openapiParse';

function MarkdownBlock({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text.trim()}</ReactMarkdown>
    </div>
  );
}

const METHOD_CLASS: Record<string, string> = {
  GET: 'get',
  POST: 'post',
  PATCH: 'patch',
  PUT: 'put',
  DELETE: 'delete'
};

type NavSection = {
  id: string;
  label: string;
  children?: Array<{ id: string; label: string }>;
};

function PermissionBadges({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) {
    return <span className="api-ref-badge api-ref-badge-muted">仅需有效 JWT</span>;
  }
  return (
    <>
      {permissions.map((code) => (
        <span key={code} className="api-ref-badge api-ref-badge-perm" title={code}>
          {permissionLabel(code)}
        </span>
      ))}
      <span className="api-ref-badge api-ref-badge-or">OR</span>
    </>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="api-ref-code-wrap">
      <div className="api-ref-code-label">{label}</div>
      <pre className="api-ref-code">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function OperationCard({ op }: { op: ParsedOperation }) {
  const curlParts = [
    `curl -X ${op.method} "${API_BASE}${op.path.replace(/\{(\w+)\}/g, '<$1>')}"`,
    op.isPublic ? '' : '-H "Authorization: Bearer <token>"'
  ];
  if (op.requestExample && op.requestContentType === 'application/json') {
    curlParts.push('-H "Content-Type: application/json"');
    curlParts.push(`-d '${JSON.stringify(op.requestExample)}'`);
  }
  const curlExample = curlParts.filter(Boolean).join(' \\\n  ');

  return (
    <article className="api-ref-operation surface-enter" id={op.id}>
      <header className="api-ref-operation-head">
        <span className={`api-ref-method api-ref-method-${METHOD_CLASS[op.method] ?? 'get'}`}>{op.method}</span>
        <code className="api-ref-path">{op.path}</code>
        {op.isPublic && <span className="api-ref-badge api-ref-badge-public">公开</span>}
      </header>
      <h3 className="api-ref-operation-title">{op.summary}</h3>
      {op.description && <MarkdownBlock text={op.description} className="api-ref-operation-desc prose" />}
      {op.operationId && (
        <p className="api-ref-operation-meta">
          <span>operationId</span> <code>{op.operationId}</code>
        </p>
      )}

      <div className="api-ref-operation-section">
        <h4>权限</h4>
        <div className="api-ref-badge-row">
          <PermissionBadges permissions={op.permissions} />
        </div>
        {op.permissions.length > 1 && (
          <p className="api-ref-hint">装饰器权限为 OR 关系，拥有其中任一即可；管理员 bypass 全部权限检查。</p>
        )}
      </div>

      {op.serviceRules.length > 0 && (
        <div className="api-ref-operation-section">
          <h4>服务层规则</h4>
          <ul className="api-ref-rules">
            {op.serviceRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {op.parameters.length > 0 && (
        <div className="api-ref-operation-section">
          <h4>参数</h4>
          <div className="api-ref-param-table-wrap">
            <table className="api-ref-param-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>位置</th>
                  <th>必填</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {op.parameters.map((param) => (
                  <tr key={`${param.in}-${param.name}`}>
                    <td>
                      <code>{param.name}</code>
                    </td>
                    <td>{param.in}</td>
                    <td>{param.required ? '是' : '否'}</td>
                    <td>{param.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {op.requestExample !== null && (
        <CodeBlock
          label={`请求体${op.requestContentType ? ` (${op.requestContentType})` : ''}`}
          code={formatJson(op.requestExample)}
        />
      )}

      {op.responses.length > 0 && (
        <div className="api-ref-operation-section">
          <h4>响应</h4>
          <div className="api-ref-responses">
            {op.responses.map((response) => (
              <div key={response.status} className="api-ref-response">
                <div className="api-ref-response-head">
                  <span className={`api-ref-status api-ref-status-${response.status.charAt(0)}xx`}>
                    {response.status}
                  </span>
                  <span>{response.description}</span>
                </div>
                {response.example !== null && (
                  <pre className="api-ref-code api-ref-code-compact">
                    <code>{formatJson(response.example)}</code>
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <CodeBlock label="cURL 示例" code={curlExample} />
    </article>
  );
}

function ApiReferenceContent({ spec }: { spec: ParsedOpenApi }) {
  const serverUrl = spec.servers[0]?.url ?? API_BASE;

  return (
    <div className="api-ref-content">
      <section className="api-ref-section" id="overview">
        <h2>概览</h2>
        <MarkdownBlock text={spec.description} className="api-ref-intro prose" />
        <dl className="api-ref-meta-grid">
          <div>
            <dt>版本</dt>
            <dd>{spec.version}</dd>
          </div>
          <div>
            <dt>默认 Base URL</dt>
            <dd>
              <code>{serverUrl}</code>
            </dd>
          </div>
          <div>
            <dt>OpenAPI</dt>
            <dd>
              <a href={`${import.meta.env.BASE_URL}openapi.yaml`} target="_blank" rel="noreferrer">
                openapi.yaml
              </a>
            </dd>
          </div>
        </dl>
        <p className="api-ref-more">
          工作流、撤销操作与活动类型详见{' '}
          <Link to="/docs/api-guide">API 使用指南</Link>；面向 AI 代理的决策树见{' '}
          <Link to="/docs/ai-guide">AI 代理指南</Link>。
        </p>
      </section>

      <section className="api-ref-section" id="auth">
        <h2>认证</h2>
        <p>
          除注册 / 登录外，请求须携带 <code>Authorization: Bearer &lt;JWT&gt;</code>。{spec.authDescription}
        </p>
        <CodeBlock
          label="登录"
          code={`POST ${serverUrl}/auth/login\nContent-Type: application/json\n\n${formatJson({ username: 'admin', password: 'admin123' })}`}
        />
        <CodeBlock
          label="后续请求"
          code={`GET ${serverUrl}/auth/me\nAuthorization: Bearer <accessToken>`}
        />
        <ul className="api-ref-list">
          <li>
            <code>POST /auth/register</code>、<code>POST /auth/login</code> 为公开端点
          </li>
          <li>
            写操作前建议 <code>GET /auth/me</code> 预检 <code>role.permissions</code>
          </li>
          <li>
            <code>isAdmin: true</code> 绕过所有 Permission 装饰器检查
          </li>
        </ul>
      </section>

      <section className="api-ref-section" id="errors">
        <h2>错误码</h2>
        <p>NestJS 统一返回 <code>{'{ statusCode, message }'}</code>；<code>message</code> 可能为字符串或字符串数组。</p>
        <div className="api-ref-error-grid">
          {spec.errorResponses.map((item) => (
            <div key={item.name} className="api-ref-error-card">
              <div className="api-ref-error-head">
                <span className={`api-ref-status api-ref-status-${item.status.charAt(0)}xx`}>{item.status}</span>
                <strong>{item.description}</strong>
              </div>
              {item.example !== null && (
                <pre className="api-ref-code api-ref-code-compact">
                  <code>{formatJson(item.example)}</code>
                </pre>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="api-ref-section" id="permissions">
        <h2>权限摘要</h2>
        <p>
          <code>x-permissions</code> 为 OR 关系；空数组表示仅需 JWT。完整矩阵与人员 PATCH 动态鉴权见{' '}
          <Link to="/docs/api-guide#权限矩阵摘要">API 使用指南</Link>。
        </p>
        <div className="api-ref-perm-table-wrap">
          <table className="api-ref-perm-table">
            <thead>
              <tr>
                <th>权限</th>
                <th>分组</th>
                <th>说明</th>
                <th>主要 API</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_DOCS.map((item) => (
                <tr key={item.code}>
                  <td>
                    <code>{item.code}</code>
                  </td>
                  <td>{item.group}</td>
                  <td>{item.summary}</td>
                  <td>
                    {item.apis.map((api) => (
                      <code key={api} className="api-ref-api-chip">
                        {api}
                      </code>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {spec.tags.map((tag) => (
        <section className="api-ref-section" key={tag.name} id={`tag-${tag.name.toLowerCase()}`}>
          <h2>{tag.name}</h2>
          {tag.description && <MarkdownBlock text={tag.description} className="api-ref-tag-desc prose" />}
          <div className="api-ref-operations">
            {tag.operations.map((op) => (
              <OperationCard key={op.id} op={op} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function ApiReference() {
  const [spec, setSpec] = useState<ParsedOpenApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}openapi.yaml`)
      .then((response) => {
        if (!response.ok) throw new Error(`加载失败 (${response.status})`);
        return response.text();
      })
      .then((text) => setSpec(parseOpenApiDocument(text)))
      .catch((err: Error) => setError(err.message));
  }, []);

  const navSections = useMemo((): NavSection[] => {
    if (!spec) return [];
    const fixed: NavSection[] = [
      { id: 'overview', label: '概览' },
      { id: 'auth', label: '认证' },
      { id: 'errors', label: '错误码' },
      { id: 'permissions', label: '权限' }
    ];
    const tags: NavSection[] = spec.tags.map((tag) => ({
      id: `tag-${tag.name.toLowerCase()}`,
      label: tag.name,
      children: tag.operations.map((op) => ({ id: op.id, label: `${op.method} ${op.path}` }))
    }));
    return [...fixed, ...tags];
  }, [spec]);

  useEffect(() => {
    if (!spec) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] }
    );
    for (const section of navSections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
      for (const child of section.children ?? []) {
        const childEl = document.getElementById(child.id);
        if (childEl) observer.observe(childEl);
      }
    }
    return () => observer.disconnect();
  }, [spec, navSections]);

  if (error) {
    return <div className="ai-guide-error">无法加载 API 规范：{error}</div>;
  }

  if (!spec) {
    return <div className="ai-guide-loading">加载 API 参考…</div>;
  }

  return (
    <div className="api-ref-layout">
      <aside className="api-ref-sidebar" aria-label="API 导航">
        <p className="api-ref-sidebar-title">目录</p>
        <nav className="api-ref-nav">
          {navSections.map((section) => (
            <div key={section.id} className="api-ref-nav-group">
              <a
                href={`#${section.id}`}
                className={activeSection === section.id ? 'active' : undefined}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </a>
              {section.children && (
                <ul>
                  {section.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`#${child.id}`}
                        className={activeSection === child.id ? 'active' : undefined}
                        onClick={() => setActiveSection(child.id)}
                      >
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>
      <ApiReferenceContent spec={spec} />
    </div>
  );
}
