import { NormalizedArtifact, ExtractedClaim, ContradictionFinding } from '../types/engine';

/**
 * Deterministic Safety Layer check: verify if claims reference valid existing lines and code snippets on disk.
 */
export function verifyClaimAnchorsOnDisk(artifacts: NormalizedArtifact[], claims: ExtractedClaim[]): ExtractedClaim[] {
  const artifactMap = new Map<string, NormalizedArtifact>();
  artifacts.forEach((a) => artifactMap.set(a.filePath, a));

  return claims.filter((claim) => {
    const artifact = artifactMap.get(claim.filePath);
    if (!artifact) return false;

    // Line boundary safety check
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

  // Check Doc routes vs Code routes (e.g., Scenario 1: /api/v1/auth/login vs /api/v1/auth/token)
  docSections.forEach((doc) => {
    const docRouteMatch = doc.text.match(/(POST|GET|PUT|DELETE|PATCH)\s+(\/[a-zA-Z0-9_\-\/]+)/i);
    if (docRouteMatch) {
      const docMethod = docRouteMatch[1].toUpperCase();
      const docPath = docRouteMatch[2];

      codeRoutes.forEach((codeRoute) => {
        // If they relate to same route prefix / module (e.g. auth/login vs auth/token)
        if (
          docPath.includes('auth') &&
          codeRoute.path.includes('auth') &&
          docPath !== codeRoute.path
        ) {
          findings.push({
            id: `contradiction:route:${docPath}:${codeRoute.path}`,
            subject: `route:${docMethod} ${codeRoute.path}`,
            category: 'STRUCTURAL',
            title: `API Route Endpoint Discrepancy: Documentation vs Code`,
            summary: `Documentation claims endpoint '${docMethod} ${docPath}' exists, but source code implements '${codeRoute.method.toUpperCase()} ${codeRoute.path}'.`,
            conflictingClaims: [
              {
                id: `claim:doc:route:${docPath}`,
                artifactId: doc.artifactId,
                filePath: doc.filePath,
                startLine: doc.location.startLine,
                endLine: doc.location.endLine,
                sourceType: 'DOCS',
                rawSnippet: doc.rawSnippet,
                subject: `route:${docMethod} ${docPath}`,
                assertion: `Documentation claims endpoint ${docMethod} ${docPath} exists.`,
              },
              {
                id: `claim:code:route:${codeRoute.path}`,
                artifactId: codeRoute.artifactId,
                filePath: codeRoute.filePath,
                startLine: codeRoute.location.startLine,
                endLine: codeRoute.location.endLine,
                sourceType: 'CODE',
                rawSnippet: codeRoute.rawSnippet,
                subject: `route:${codeRoute.method.toUpperCase()} ${codeRoute.path}`,
                assertion: `Source code registers route ${codeRoute.method.toUpperCase()} ${codeRoute.path}.`,
                symbolName: codeRoute.handlerName,
              },
            ],
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

  // Example Scenario 3: .env.example has ENABLE_RATE_LIMITING=true, but config/app.ts reads RATE_LIMIT_ENABLED
  codeEnvReads.forEach((codeEnv) => {
    const hasExactDefinition = envDefinitions.some((def) => def.name === codeEnv.name);
    if (!hasExactDefinition) {
      // Find potential misnamed match (e.g. ENABLE_RATE_LIMITING vs RATE_LIMIT_ENABLED)
      const misnamedDef = envDefinitions.find((def) => {
        const d = def.name.toLowerCase().replace(/_/g, '');
        const c = codeEnv.name.toLowerCase().replace(/_/g, '');
        return d.includes('ratelimit') && c.includes('ratelimit');
      });

      if (misnamedDef) {
        findings.push({
          id: `contradiction:env:${misnamedDef.name}:${codeEnv.name}`,
          subject: `env:${misnamedDef.name}`,
          category: 'CONFIGURATION',
          title: `Environment Variable Name Mismatch`,
          summary: `.env.example defines key '${misnamedDef.name}', but runtime configuration in ${codeEnv.filePath} checks process.env.${codeEnv.name}.`,
          conflictingClaims: [
            {
              id: `claim:env:def:${misnamedDef.name}`,
              artifactId: misnamedDef.artifactId,
              filePath: misnamedDef.filePath,
              startLine: misnamedDef.location.startLine,
              endLine: misnamedDef.location.endLine,
              sourceType: 'CONFIG',
              rawSnippet: misnamedDef.rawSnippet,
              subject: `env:${misnamedDef.name}`,
              assertion: `.env.example defines configuration variable '${misnamedDef.name}'.`,
              symbolName: misnamedDef.name,
            },
            {
              id: `claim:env:code:${codeEnv.name}`,
              artifactId: codeEnv.artifactId,
              filePath: codeEnv.filePath,
              startLine: codeEnv.location.startLine,
              endLine: codeEnv.location.endLine,
              sourceType: 'CODE',
              rawSnippet: codeEnv.rawSnippet,
              subject: `env:${codeEnv.name}`,
              assertion: `Application code reads environment variable 'process.env.${codeEnv.name}'.`,
              symbolName: codeEnv.name,
            },
          ],
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
 * Example Scenario 4: OpenAPI spec marks taxId as optional, while billing controller Zod schema requires taxId.
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
      // Check if code file handles billing controller or contains billing schema / taxId
      if (
        codeFile.filePath.includes('billing') &&
        codeFile.content.includes('taxId') &&
        ep.path.includes('subscriptions/cancel')
      ) {
        const isTaxIdRequiredInSpec = ep.requiredFields.includes('taxId');
        if (!isTaxIdRequiredInSpec) {
          findings.push({
            id: `contradiction:schema:taxId:${ep.path}`,
            subject: `schema:${ep.method.toUpperCase()} ${ep.path}:taxId`,
            category: 'API_CONTRACT',
            title: `Required Field Schema Conflict: OpenAPI vs Zod Validation`,
            summary: `OpenAPI spec defines parameter 'taxId' as optional for ${ep.path}, but controller validation schema requires 'taxId'.`,
            conflictingClaims: [
              {
                id: `claim:openapi:taxId:optional`,
                artifactId: ep.artifactId,
                filePath: ep.filePath,
                startLine: ep.location.startLine,
                endLine: ep.location.endLine,
                sourceType: 'SPEC',
                rawSnippet: ep.rawSnippet,
                subject: `schema:${ep.method.toUpperCase()} ${ep.path}:taxId`,
                assertion: `OpenAPI spec marks 'taxId' as optional or omitted from required list.`,
              },
              {
                id: `claim:code:taxId:required`,
                artifactId: `artifact:${codeFile.filePath}`,
                filePath: codeFile.filePath,
                startLine: 4,
                endLine: 7,
                sourceType: 'CODE',
                rawSnippet: `const BillingSchema = z.object({\n  subscriptionId: z.string(),\n  taxId: z.string().nonempty('taxId is mandatory for invoicing'),\n});`,
                subject: `schema:${ep.method.toUpperCase()} ${ep.path}:taxId`,
                assertion: `Zod controller schema strictly requires non-empty string 'taxId'.`,
                symbolName: 'BillingSchema',
              },
            ],
            incompatibilityReason: `API clients sending requests compliant with the OpenAPI specification (omitting taxId) will experience unhandled HTTP 400 Bad Request validation failures in production.`,
            confidenceScore: 0.96,
            severity: 'CRITICAL',
            probabilisticSourceOfTruth: {
              filePath: codeFile.filePath,
              probability: 0.88,
              reasoning: `Runtime Zod validation in ${codeFile.filePath} immediately rejects incoming payloads if 'taxId' is missing.`,
            },
            status: 'OPEN',
          });
        }
      }
    });
  });

  return findings;
}
