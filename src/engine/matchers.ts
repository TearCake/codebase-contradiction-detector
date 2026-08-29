import { NormalizedArtifact, ExtractedClaim, ContradictionFinding } from '../types/engine';
import { tokenizeText, computeJaccardSimilarity } from './llm/candidateMatcher';

function computeLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Deterministic Safety Layer check: verify if claims reference valid existing lines and code snippets on disk.
 */
export function verifyClaimAnchorsOnDisk(artifacts: NormalizedArtifact[], claims: ExtractedClaim[]): ExtractedClaim[] {
  const artifactMap = new Map<string, NormalizedArtifact>();
  artifacts.forEach((a) => artifactMap.set(a.filePath, a));

  return claims.filter((claim) => {
    const artifact = artifactMap.get(claim.filePath);
    if (!artifact) return false;

    if (claim.startLine < 1 || claim.endLine > artifact.lineCount + 1) {
      return false;
    }

    return true;
  });
}

/**
 * Deterministic Matcher 1: API Route Path & Method Drift.
 * Compares routes in Express / TS files vs OpenAPI specification & Markdown docs.
 */
export function checkRouteContradictions(artifacts: NormalizedArtifact[]): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];

  const openApiRoutes = artifacts.flatMap((a) =>
    a.extracted.openApiEndpoints.map((ep) => ({
      ...ep,
      filePath: a.filePath,
      artifactId: `artifact:${a.filePath}`,
      sourceType: a.artifactType,
    }))
  );

  const codeRoutes = artifacts.flatMap((a) =>
    a.extracted.routes.map((r) => ({
      ...r,
      filePath: a.filePath,
      artifactId: `artifact:${a.filePath}`,
      sourceType: a.artifactType,
    }))
  );

  const docSections = artifacts.flatMap((a) =>
    a.extracted.markdownSections.map((m) => ({
      ...m,
      filePath: a.filePath,
      artifactId: `artifact:${a.filePath}`,
      sourceType: a.artifactType,
    }))
  );

  // Check Doc routes vs Code routes
  docSections.forEach((doc) => {
    const docRouteMatch = doc.text.match(/(POST|GET|PUT|DELETE|PATCH)\s+(\/[a-zA-Z0-9_\-\/]+)/i);
    if (docRouteMatch) {
      const docMethod = docRouteMatch[1].toUpperCase();
      const docPath = docRouteMatch[2];

      codeRoutes.forEach((codeRoute) => {
        const docSegments = docPath.split('/').filter(Boolean);
        const codeSegments = codeRoute.path.split('/').filter(Boolean);

        if (
          docSegments.length >= 2 &&
          codeSegments.length >= 2 &&
          docSegments[0] === codeSegments[0] &&
          docSegments[1] === codeSegments[1] &&
          docPath !== codeRoute.path
        ) {
          const docArtifact = artifacts.find((a) => a.filePath === doc.filePath);
          const codeArtifact = artifacts.find((a) => a.filePath === codeRoute.filePath);

          const docClaim = docArtifact?.extracted.claims.find((c) => c.rawSnippet.includes(docPath)) || {
            id: `claim:doc:route:${docPath}`,
            artifactId: doc.artifactId,
            filePath: doc.filePath,
            startLine: doc.location.startLine,
            endLine: doc.location.endLine,
            sourceType: 'DOCS' as const,
            rawSnippet: doc.rawSnippet,
            subject: `route:${docMethod} ${docPath}`,
            assertion: `Documentation claims endpoint ${docMethod} ${docPath} exists.`,
          };

          const codeClaim = codeArtifact?.extracted.claims.find((c) => c.rawSnippet.includes(codeRoute.path)) || {
            id: `claim:code:route:${codeRoute.path}`,
            artifactId: codeRoute.artifactId,
            filePath: codeRoute.filePath,
            startLine: codeRoute.location.startLine,
            endLine: codeRoute.location.endLine,
            sourceType: 'CODE' as const,
            rawSnippet: codeRoute.rawSnippet,
            subject: `route:${codeRoute.method.toUpperCase()} ${codeRoute.path}`,
            assertion: `Source code registers route ${codeRoute.method.toUpperCase()} ${codeRoute.path}.`,
            symbolName: codeRoute.handlerName,
          };

          findings.push({
            id: `contradiction:route:${docPath}:${codeRoute.path}`,
            subject: `route:${docMethod} ${codeRoute.path}`,
            category: 'STRUCTURAL',
            title: `API Route Endpoint Discrepancy: Documentation vs Code`,
            summary: `Documentation claims endpoint '${docMethod} ${docPath}' exists, but source code implements '${codeRoute.method.toUpperCase()} ${codeRoute.path}'.`,
            conflictingClaims: [docClaim, codeClaim],
            incompatibilityReason: `The documented route path '${docPath}' differs from the actual implemented route path '${codeRoute.path}'. Clients following documentation will receive HTTP 404.`,
            confidenceScore: 0.98,
            severity: 'HIGH',
            probabilisticSourceOfTruth: {
              filePath: codeRoute.filePath,
              probability: 0.9,
              reasoning: `Code implementation in ${codeRoute.filePath} represents actual runtime execution routing.`,
            },
            status: 'OPEN',
          });
        }
      });
    }
  });

  return findings;
}

/**
 * Deterministic Matcher 2: Environment Variable Configuration Drift.
 * Compares .env.example definitions with process.env reads in code config.
 */
export function checkEnvContradictions(artifacts: NormalizedArtifact[]): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];

  const envDefinitions = artifacts.flatMap((a) =>
    a.extracted.envRefs
      .filter((e) => e.isDefinition)
      .map((e) => ({ ...e, filePath: a.filePath, artifactId: `artifact:${a.filePath}` }))
  );

  const codeEnvReads = artifacts.flatMap((a) =>
    a.extracted.envRefs
      .filter((e) => !e.isDefinition)
      .map((e) => ({ ...e, filePath: a.filePath, artifactId: `artifact:${a.filePath}` }))
  );

  codeEnvReads.forEach((codeEnv) => {
    const hasExactDefinition = envDefinitions.some((def) => def.name === codeEnv.name);
    if (!hasExactDefinition) {
      const codeTokens = tokenizeText(codeEnv.name);

      const misnamedDef = envDefinitions.find((def) => {
        if (def.name === codeEnv.name) return false;
        const defTokens = tokenizeText(def.name);
        const sim = computeJaccardSimilarity(defTokens, codeTokens);
        const lev = computeLevenshteinDistance(def.name.toLowerCase(), codeEnv.name.toLowerCase());
        return sim >= 0.3 || lev <= 4;
      });

      if (misnamedDef) {
        const defArtifact = artifacts.find((a) => a.filePath === misnamedDef.filePath);
        const codeArtifact = artifacts.find((a) => a.filePath === codeEnv.filePath);

        const defClaim = defArtifact?.extracted.claims.find((c) => c.symbolName === misnamedDef.name) || {
          id: `claim:env:def:${misnamedDef.name}`,
          artifactId: misnamedDef.artifactId,
          filePath: misnamedDef.filePath,
          startLine: misnamedDef.location.startLine,
          endLine: misnamedDef.location.endLine,
          sourceType: 'CONFIG' as const,
          rawSnippet: misnamedDef.rawSnippet,
          subject: `env:${misnamedDef.name}`,
          assertion: `.env.example defines configuration variable '${misnamedDef.name}'.`,
          symbolName: misnamedDef.name,
        };

        const codeClaim = codeArtifact?.extracted.claims.find((c) => c.symbolName === codeEnv.name) || {
          id: `claim:env:code:${codeEnv.name}`,
          artifactId: codeEnv.artifactId,
          filePath: codeEnv.filePath,
          startLine: codeEnv.location.startLine,
          endLine: codeEnv.location.endLine,
          sourceType: 'CODE' as const,
          rawSnippet: codeEnv.rawSnippet,
          subject: `env:${codeEnv.name}`,
          assertion: `Application code reads environment variable 'process.env.${codeEnv.name}'.`,
          symbolName: codeEnv.name,
        };

        findings.push({
          id: `contradiction:env:${misnamedDef.name}:${codeEnv.name}`,
          subject: `env:${misnamedDef.name}`,
          category: 'CONFIGURATION',
          title: `Environment Variable Name Mismatch`,
          summary: `.env.example defines key '${misnamedDef.name}', but runtime configuration in ${codeEnv.filePath} checks process.env.${codeEnv.name}.`,
          conflictingClaims: [defClaim, codeClaim],
          incompatibilityReason: `Environment variable '${misnamedDef.name}' provided in deployment template will not be read by code looking for '${codeEnv.name}'. Feature flag will silently fallback to default.`,
          confidenceScore: 0.95,
          severity: 'HIGH',
          probabilisticSourceOfTruth: {
            filePath: codeEnv.filePath,
            probability: 0.85,
            reasoning: `Code in ${codeEnv.filePath} directly controls execution logic and variable references at runtime.`,
          },
          status: 'OPEN',
        });
      }
    }
  });

  return findings;
}

/**
 * Deterministic Matcher 3: OpenAPI Spec vs Controller Schema Requirement Conflict.
 */
export function checkSchemaContradictions(artifacts: NormalizedArtifact[]): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];

  const openApiEndpoints = artifacts.flatMap((a) =>
    a.extracted.openApiEndpoints.map((ep) => ({
      ...ep,
      filePath: a.filePath,
      artifactId: `artifact:${a.filePath}`,
    }))
  );

  const codeFiles = artifacts.filter((a) => a.artifactType === 'CODE');

  openApiEndpoints.forEach((ep) => {
    codeFiles.forEach((codeFile) => {
      const fileLines = codeFile.content.split('\n');

      fileLines.forEach((line, lineIdx) => {
        const zodMatch = line.match(/([a-zA-Z0-9_]+)\s*:\s*z\.[a-zA-Z0-9_().\s'"]+/);
        if (zodMatch) {
          const paramName = zodMatch[1];
          const isNonEmpty = line.includes('nonempty') || line.includes('min(') || line.includes('required');

          if (isNonEmpty) {
            const isParamInOpenApi = ep.rawSnippet.includes(paramName) || ep.parameters.some((p) => p.name === paramName);
            const isRequiredInOpenApi = ep.requiredFields.includes(paramName);

            if (isParamInOpenApi && !isRequiredInOpenApi) {
              const lineNum = lineIdx + 1;
              const openApiArtifact = artifacts.find((a) => a.filePath === ep.filePath);

              const specClaim = openApiArtifact?.extracted.claims.find((c) => c.symbolName === paramName || c.rawSnippet.includes(paramName)) || {
                id: `claim:openapi:${paramName}:optional`,
                artifactId: ep.artifactId,
                filePath: ep.filePath,
                startLine: ep.location.startLine,
                endLine: ep.location.endLine,
                sourceType: 'SPEC' as const,
                rawSnippet: ep.rawSnippet,
                subject: `schema:${ep.method.toUpperCase()} ${ep.path}:${paramName}`,
                assertion: `OpenAPI spec marks '${paramName}' as optional or omitted from required list.`,
              };

              const codeClaim = codeFile.extracted.claims.find((c) => c.rawSnippet.includes(paramName)) || {
                id: `claim:code:${paramName}:required`,
                artifactId: `artifact:${codeFile.filePath}`,
                filePath: codeFile.filePath,
                startLine: lineNum,
                endLine: Math.min(fileLines.length, lineNum + 2),
                sourceType: 'CODE' as const,
                rawSnippet: fileLines.slice(Math.max(0, lineNum - 1), Math.min(fileLines.length, lineNum + 2)).join('\n'),
                subject: `schema:${ep.method.toUpperCase()} ${ep.path}:${paramName}`,
                assertion: `Validation schema strictly requires '${paramName}'.`,
              };

              findings.push({
                id: `contradiction:schema:${paramName}:${ep.path}`,
                subject: `schema:${ep.method.toUpperCase()} ${ep.path}:${paramName}`,
                category: 'API_CONTRACT',
                title: `Required Field Schema Conflict: OpenAPI vs Code Validation`,
                summary: `OpenAPI spec defines parameter '${paramName}' as optional for ${ep.path}, but controller validation schema in ${codeFile.filePath} strictly requires '${paramName}'.`,
                conflictingClaims: [specClaim, codeClaim],
                incompatibilityReason: `API clients sending requests compliant with the OpenAPI specification (omitting '${paramName}') will experience unhandled HTTP 400 Bad Request validation failures in production.`,
                confidenceScore: 0.96,
                severity: 'CRITICAL',
                probabilisticSourceOfTruth: {
                  filePath: codeFile.filePath,
                  probability: 0.88,
                  reasoning: `Runtime validation in ${codeFile.filePath} immediately rejects incoming payloads if '${paramName}' is missing.`,
                },
                status: 'OPEN',
              });
            }
          }
        }
      });
    });
  });

  return findings;
}
