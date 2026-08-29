import yaml from 'yaml';
import { NormalizedArtifact, ExtractedOpenApiEndpoint, ExtractedClaim } from '../../types/engine';

export function extractOpenApiArtifacts(artifact: NormalizedArtifact): void {
  const openApiEndpoints: ExtractedOpenApiEndpoint[] = [];
  const claims: ExtractedClaim[] = [];

  try {
    let doc: Record<string, unknown> | null = null;
    if (artifact.format === 'json') {
      doc = JSON.parse(artifact.content);
    } else {
      doc = yaml.parse(artifact.content);
    }

    if (!doc || typeof doc !== 'object' || !doc.paths || typeof doc.paths !== 'object') {
      return;
    }

    const lines = artifact.content.split('\n');

    for (const [pathKey, pathObj] of Object.entries(doc.paths as Record<string, unknown>)) {
      if (!pathObj || typeof pathObj !== 'object') continue;

      for (const [methodKey, methodObj] of Object.entries(pathObj as Record<string, unknown>)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(methodKey.toLowerCase())) {
          const method = methodKey.toUpperCase();
          const endpointObj = methodObj as {
            operationId?: string;
            summary?: string;
            description?: string;
            parameters?: Array<{ name: string; in: string; required?: boolean; schema?: { type?: string } }>;
            requestBody?: { required?: boolean; content?: { 'application/json'?: { schema?: { properties?: Record<string, unknown>; required?: string[] } } } };
            responses?: Record<string, { description?: string }>;
          };

          const lineIndex = lines.findIndex(l => l.includes(pathKey)) + 1 || 1;
          const endLine = Math.min(lineIndex + 20, lines.length);

          const parameters = (endpointObj.parameters || []).map(p => ({
            name: p.name,
            in: p.in,
            required: !!p.required,
            schemaType: p.schema?.type,
          }));

          const jsonSchema = endpointObj.requestBody?.content?.['application/json']?.schema;
          const requiredFields = jsonSchema?.required || [];

          const responses = Object.entries(endpointObj.responses || {}).map(([code, resp]) => ({
            statusCode: code,
            description: resp?.description,
          }));

          const rawSnippet = lines.slice(Math.max(0, lineIndex - 1), endLine).join('\n');

          openApiEndpoints.push({
            method,
            path: pathKey,
            operationId: endpointObj.operationId,
            summary: endpointObj.summary,
            description: endpointObj.description,
            parameters,
            requestBodyRequired: endpointObj.requestBody?.required,
            requestBodySchema: jsonSchema,
            requiredFields,
            responses,
            location: { startLine: lineIndex, endLine },
            rawSnippet,
          });

          // Generic Endpoint claim
          claims.push({
            id: `claim-${artifact.filePath}-openapi-${method}-${pathKey}`,
            artifactId: artifact.id,
            filePath: artifact.filePath,
            startLine: lineIndex,
            endLine,
            sourceType: 'SPEC',
            rawSnippet,
            subject: `route:${method} ${pathKey}`,
            assertion: `OpenAPI spec declares endpoint: ${method} ${pathKey}`,
            metadata: { method, routePath: pathKey, kind: 'OPENAPI_ROUTE' },
          });

          // Generic Field requirement claims
          if (jsonSchema && jsonSchema.properties) {
            const reqSet = new Set(requiredFields);
            for (const fieldName of Object.keys(jsonSchema.properties)) {
              const isRequired = reqSet.has(fieldName);
              claims.push({
                id: `claim-${artifact.filePath}-openapi-field-${fieldName}`,
                artifactId: artifact.id,
                filePath: artifact.filePath,
                startLine: lineIndex,
                endLine: lineIndex + 15,
                sourceType: 'SPEC',
                rawSnippet: `Field '${fieldName}' in OpenAPI schema. Required: ${isRequired}`,
                subject: `schema:${method} ${pathKey}:${fieldName}`,
                assertion: `OpenAPI declares field '${fieldName}' is ${isRequired ? 'REQUIRED' : 'OPTIONAL'}`,
                symbolName: fieldName,
                metadata: { fieldName, required: isRequired, kind: 'OPENAPI_FIELD_REQUIREMENT' },
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error extracting OpenAPI artifacts in ${artifact.filePath}:`, err);
  }

  artifact.extracted.openApiEndpoints = openApiEndpoints;
  artifact.extracted.claims = claims;
}
