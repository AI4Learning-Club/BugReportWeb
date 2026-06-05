import { parse as parseYaml } from 'yaml';

type JsonSchema = Record<string, unknown>;

export type ParsedOperation = {
  id: string;
  method: string;
  path: string;
  tags: string[];
  summary: string;
  description?: string;
  operationId?: string;
  permissions: string[];
  serviceRules: string[];
  isPublic: boolean;
  parameters: Array<{ name: string; in: string; required?: boolean; description?: string }>;
  requestExample: unknown | null;
  requestContentType: string | null;
  responses: Array<{
    status: string;
    description: string;
    example: unknown | null;
  }>;
};

export type ParsedTag = {
  name: string;
  description?: string;
  operations: ParsedOperation[];
};

export type ParsedOpenApi = {
  title: string;
  version: string;
  description: string;
  servers: Array<{ url: string; description?: string }>;
  authDescription: string;
  tags: ParsedTag[];
  errorResponses: Array<{ name: string; status: string; description: string; example: unknown }>;
};

function slugifyOperation(method: string, path: string) {
  return `${method}-${path.replace(/^\//, '').replace(/[{}]/g, '').replace(/\//g, '-')}`;
}

function resolveRef(ref: string, schemas: Record<string, JsonSchema>): JsonSchema | undefined {
  const name = ref.replace('#/components/schemas/', '');
  return schemas[name];
}

function mergeSchemas(schemas: JsonSchema[], components: Record<string, JsonSchema>, depth: number): JsonSchema {
  const merged: JsonSchema = { type: 'object', properties: {} };
  const properties = merged.properties as Record<string, JsonSchema>;
  for (const schema of schemas) {
    const resolved = resolveSchema(schema, components, depth);
    if (resolved?.properties) {
      Object.assign(properties, resolved.properties as Record<string, JsonSchema>);
    }
  }
  return merged;
}

function resolveSchema(
  schema: JsonSchema | undefined,
  components: Record<string, JsonSchema>,
  depth: number
): JsonSchema | undefined {
  if (!schema || depth > 10) return schema;
  if (typeof schema.$ref === 'string') {
    return resolveSchema(resolveRef(schema.$ref, components), components, depth + 1);
  }
  if (Array.isArray(schema.allOf)) {
    return mergeSchemas(schema.allOf as JsonSchema[], components, depth + 1);
  }
  if (Array.isArray(schema.oneOf)) {
    return resolveSchema((schema.oneOf as JsonSchema[])[0], components, depth + 1);
  }
  return schema;
}

export function generateExample(
  schema: JsonSchema | undefined,
  components: Record<string, JsonSchema>,
  depth = 0
): unknown {
  const resolved = resolveSchema(schema, components, depth);
  if (!resolved) return null;

  if (resolved.example !== undefined) return resolved.example;
  if (resolved.const !== undefined) return resolved.const;
  if (Array.isArray(resolved.enum)) return resolved.enum[0];

  switch (resolved.type) {
    case 'object': {
      const props = resolved.properties as Record<string, JsonSchema> | undefined;
      if (!props) return {};
      const result: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(props)) {
        result[key] = generateExample(prop, components, depth + 1);
      }
      return result;
    }
    case 'array': {
      const items = resolved.items as JsonSchema | undefined;
      return [generateExample(items, components, depth + 1)];
    }
    case 'string':
      if (resolved.format === 'date-time') return '2024-06-01T08:00:00.000Z';
      return 'string';
    case 'integer':
      return 0;
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return null;
  }
}

function pickMediaExample(media: {
  schema?: JsonSchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown; summary?: string }>;
}): unknown | null {
  if (media.example !== undefined) return media.example;
  if (media.examples) {
    const first = Object.values(media.examples)[0];
    if (first?.value !== undefined) return first.value;
  }
  return null;
}

function extractRequestExample(
  requestBody: JsonSchema | undefined,
  components: Record<string, JsonSchema>
): { example: unknown | null; contentType: string | null } {
  if (!requestBody?.content) return { example: null, contentType: null };
  const content = requestBody.content as Record<
    string,
    { schema?: JsonSchema; example?: unknown; examples?: Record<string, { value?: unknown }> }
  >;
  const contentType = Object.keys(content)[0] ?? null;
  if (!contentType) return { example: null, contentType: null };
  const media = content[contentType];
  const picked = pickMediaExample(media);
  if (picked !== null) return { example: picked, contentType };
  return {
    example: generateExample(media.schema, components),
    contentType
  };
}

function extractJsonMediaExample(
  content: Record<string, { schema?: JsonSchema; example?: unknown; examples?: Record<string, { value?: unknown }> }> | undefined,
  components: Record<string, JsonSchema>
): unknown | null {
  if (!content?.['application/json']) return null;
  const media = content['application/json'];
  const picked = pickMediaExample(media);
  if (picked !== null) return picked;
  return generateExample(media.schema, components);
}

function extractResponseExamples(
  responses: Record<string, JsonSchema> | undefined,
  sharedResponses: Record<string, JsonSchema>,
  components: Record<string, JsonSchema>
): ParsedOperation['responses'] {
  if (!responses) return [];
  return Object.entries(responses).map(([status, response]) => {
    let example: unknown | null = extractJsonMediaExample(
      response.content as Record<string, { schema?: JsonSchema; example?: unknown; examples?: Record<string, { value?: unknown }> }>,
      components
    );
    let description = String(response.description ?? '');

    if (typeof response.$ref === 'string') {
      const refName = response.$ref.replace('#/components/responses/', '');
      const refResponse = sharedResponses[refName];
      if (refResponse) {
        if (!description && refResponse.description) {
          description = String(refResponse.description);
        }
        if (!example) {
          example = extractJsonMediaExample(
            refResponse.content as Record<string, { schema?: JsonSchema; example?: unknown; examples?: Record<string, { value?: unknown }> }>,
            components
          );
        }
      }
    }

    return { status, description, example };
  });
}

function resolveParameter(
  param: JsonSchema,
  sharedParameters: Record<string, JsonSchema>
): { name: string; in: string; required?: boolean; description?: string } {
  if (typeof param.$ref === 'string') {
    const refName = param.$ref.replace('#/components/parameters/', '');
    return resolveParameter(sharedParameters[refName] ?? {}, sharedParameters);
  }
  return {
    name: String(param.name ?? ''),
    in: String(param.in ?? ''),
    required: Boolean(param.required),
    description: param.description ? String(param.description) : undefined
  };
}

const ERROR_STATUS_MAP: Record<string, string> = {
  BadRequest: '400',
  Unauthorized: '401',
  Forbidden: '403',
  NotFound: '404',
  Conflict: '409'
};

export function parseOpenApiDocument(raw: string): ParsedOpenApi {
  const spec = parseYaml(raw) as JsonSchema;
  const info = spec.info as JsonSchema;
  const components = (spec.components ?? {}) as JsonSchema;
  const schemas = (components.schemas ?? {}) as Record<string, JsonSchema>;
  const sharedResponses = (components.responses ?? {}) as Record<string, JsonSchema>;
  const sharedParameters = (components.parameters ?? {}) as Record<string, JsonSchema>;

  const tagMeta = new Map<string, string>();
  for (const tag of (spec.tags as JsonSchema[]) ?? []) {
    tagMeta.set(String(tag.name), String(tag.description ?? ''));
  }

  const operationsByTag = new Map<string, ParsedOperation[]>();
  const paths = (spec.paths ?? {}) as Record<string, Record<string, JsonSchema>>;

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = pathItem[method];
      if (!op) continue;

      const tags = (op.tags as string[]) ?? ['Other'];
      const security = op.security as JsonSchema[] | undefined;
      const isPublic = security !== undefined && security.length === 0;
      const permissions = (op['x-permissions'] as string[]) ?? [];
      const serviceRules = (op['x-service-rules'] as string[]) ?? [];
      const { example: requestExample, contentType: requestContentType } = extractRequestExample(
        op.requestBody as JsonSchema | undefined,
        schemas
      );

      const responses = extractResponseExamples(
        op.responses as Record<string, JsonSchema>,
        sharedResponses,
        schemas
      );

      const operation: ParsedOperation = {
        id: slugifyOperation(method, path),
        method: method.toUpperCase(),
        path,
        tags,
        summary: String(op.summary ?? op.operationId ?? path),
        description: op.description ? String(op.description) : undefined,
        operationId: op.operationId ? String(op.operationId) : undefined,
        permissions,
        serviceRules,
        isPublic,
        parameters: ((op.parameters as JsonSchema[]) ?? []).map((param) =>
          resolveParameter(param, sharedParameters)
        ),
        requestExample,
        requestContentType,
        responses
      };

      for (const tag of tags) {
        if (!operationsByTag.has(tag)) operationsByTag.set(tag, []);
        operationsByTag.get(tag)!.push(operation);
      }
    }
  }

  const tagOrder = ((spec.tags as JsonSchema[]) ?? []).map((t) => String(t.name));
  const tags: ParsedTag[] = [];
  for (const name of tagOrder) {
    const ops = operationsByTag.get(name);
    if (ops?.length) {
      tags.push({ name, description: tagMeta.get(name), operations: ops });
      operationsByTag.delete(name);
    }
  }
  for (const [name, ops] of operationsByTag) {
    tags.push({ name, description: tagMeta.get(name), operations: ops });
  }

  const securitySchemes = (components.securitySchemes ?? {}) as Record<string, JsonSchema>;
  const bearer = securitySchemes.bearerAuth;
  const authDescription = bearer?.description ? String(bearer.description) : 'JWT Bearer 认证';

  const errorResponses = Object.entries(sharedResponses).map(([name, response]) => ({
    name,
    status: ERROR_STATUS_MAP[name] ?? name,
    description: String(response.description ?? ''),
    example:
      extractJsonMediaExample(
        response.content as Record<string, { schema?: JsonSchema; example?: unknown; examples?: Record<string, { value?: unknown }> }>,
        schemas
      ) ?? generateExample(
        (response.content as Record<string, { schema?: JsonSchema }>)?.['application/json']?.schema,
        schemas
      )
  }));

  return {
    title: String(info.title ?? 'API'),
    version: String(info.version ?? '1.0'),
    description: String(info.description ?? ''),
    servers: ((spec.servers as JsonSchema[]) ?? []).map((s) => ({
      url: String(s.url ?? ''),
      description: s.description ? String(s.description) : undefined
    })),
    authDescription,
    tags,
    errorResponses
  };
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
