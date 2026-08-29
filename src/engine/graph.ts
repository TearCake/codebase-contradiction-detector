import { NormalizedArtifact, RepositoryContextGraph, ContextGraphNode, ContextGraphEdge, ExtractedClaim } from '../types/engine';

export function buildRepositoryContextGraph(artifacts: NormalizedArtifact[]): {
  graph: RepositoryContextGraph;
  claims: ExtractedClaim[];
} {
  const nodes: ContextGraphNode[] = [];
  const edges: ContextGraphEdge[] = [];
  const claims: ExtractedClaim[] = [];

  const subjectMap = new Set<string>();

  artifacts.forEach((artifact) => {
    // 1. Add Artifact Node
    const artifactNodeId = `artifact:${artifact.filePath}`;
    nodes.push({
      id: artifactNodeId,
      type: 'ARTIFACT',
      label: artifact.filePath,
      data: {
        artifactType: artifact.artifactType,
        format: artifact.format,
        lineCount: artifact.lineCount,
      },
    });

    const fileClaims: ExtractedClaim[] = [];

    // Extract Claims from Routes
    artifact.extracted.routes.forEach((route, idx) => {
      const subject = `route:${route.method.toUpperCase()} ${route.path}`;
      const claim: ExtractedClaim = {
        id: `claim:${artifact.filePath}:route:${idx}`,
        artifactId: artifactNodeId,
        filePath: artifact.filePath,
        startLine: route.location.startLine,
        endLine: route.location.endLine,
        sourceType: artifact.artifactType,
        rawSnippet: route.rawSnippet,
        subject,
        assertion: `Route handler '${route.handlerName || 'anonymous'}' implements ${route.method.toUpperCase()} ${route.path}`,
        symbolName: route.handlerName,
      };
      fileClaims.push(claim);
    });

    // Extract Claims from OpenAPI Endpoints
    artifact.extracted.openApiEndpoints.forEach((ep, idx) => {
      const subject = `route:${ep.method.toUpperCase()} ${ep.path}`;
      const requiredFieldsStr = ep.requiredFields.length > 0 ? ep.requiredFields.join(', ') : 'none';
      const claim: ExtractedClaim = {
        id: `claim:${artifact.filePath}:openapi:${idx}`,
        artifactId: artifactNodeId,
        filePath: artifact.filePath,
        startLine: ep.location.startLine,
        endLine: ep.location.endLine,
        sourceType: artifact.artifactType,
        rawSnippet: ep.rawSnippet,
        subject,
        assertion: `OpenAPI spec declares ${ep.method.toUpperCase()} ${ep.path} with required body fields: [${requiredFieldsStr}]`,
        metadata: {
          operationId: ep.operationId,
          parameters: ep.parameters,
          requiredFields: ep.requiredFields,
        },
      };
      fileClaims.push(claim);

      // Add parameter schemas as subjects as well
      ep.requiredFields.forEach((field) => {
        const paramSubject = `schema:${ep.method.toUpperCase()} ${ep.path}:${field}`;
        const paramClaim: ExtractedClaim = {
          id: `claim:${artifact.filePath}:openapi:field:${field}`,
          artifactId: artifactNodeId,
          filePath: artifact.filePath,
          startLine: ep.location.startLine,
          endLine: ep.location.endLine,
          sourceType: artifact.artifactType,
          rawSnippet: ep.rawSnippet,
          subject: paramSubject,
          assertion: `OpenAPI schema requires parameter/field '${field}' for ${ep.method.toUpperCase()} ${ep.path}`,
          metadata: { field, required: true },
        };
        fileClaims.push(paramClaim);
      });
    });

    // Extract Claims from Env Refs
    artifact.extracted.envRefs.forEach((env, idx) => {
      const subject = `env:${env.name}`;
      const assertion = env.isDefinition
        ? `Env definition declares key '${env.name}' with default '${env.valueOrDefault || ''}'`
        : `Code references process.env.${env.name}`;

      const claim: ExtractedClaim = {
        id: `claim:${artifact.filePath}:env:${idx}`,
        artifactId: artifactNodeId,
        filePath: artifact.filePath,
        startLine: env.location.startLine,
        endLine: env.location.endLine,
        sourceType: artifact.artifactType,
        rawSnippet: env.rawSnippet,
        subject,
        assertion,
        symbolName: env.name,
      };
      fileClaims.push(claim);
    });

    // Extract Claims from Markdown Sections
    artifact.extracted.markdownSections.forEach((sec, idx) => {
      const text = sec.text;

      let subject = 'doc:general';
      const routeMatch = text.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\/[a-zA-Z0-9_\-\/]+)/i);
      if (routeMatch) {
        subject = `route:${routeMatch[1].toUpperCase()} ${routeMatch[2]}`;
      } else {
        // Derive subject from section topic keywords dynamically
        const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
        const uniqueTopicWords = Array.from(new Set(words.filter(w => !['the', 'and', 'for', 'with', 'this', 'can', 'you'].includes(w)))).slice(0, 3);
        if (uniqueTopicWords.length > 0) {
          subject = `topic:${uniqueTopicWords.join('_')}`;
        }
      }

      const claim: ExtractedClaim = {
        id: `claim:${artifact.filePath}:doc:${idx}`,
        artifactId: artifactNodeId,
        filePath: artifact.filePath,
        startLine: sec.location.startLine,
        endLine: sec.location.endLine,
        sourceType: artifact.artifactType,
        rawSnippet: sec.rawSnippet,
        subject,
        assertion: text.slice(0, 150),
      };
      fileClaims.push(claim);
    });

    // Extract Claims from Test Items
    artifact.extracted.testItems.forEach((test, idx) => {
      let subject = 'test:general';
      const words = test.title.toLowerCase().match(/[a-z]{3,}/g) || [];
      const uniqueTestWords = Array.from(new Set(words.filter(w => !['should', 'test', 'when', 'with', 'returns', 'does'].includes(w)))).slice(0, 3);
      if (uniqueTestWords.length > 0) {
        subject = `topic:${uniqueTestWords.join('_')}`;
      }

      const assertionsSummary = test.assertions
        .map((a) => `${a.type}(${a.target || ''}${a.expected ? ', ' + a.expected : ''})`)
        .join('; ');

      const claim: ExtractedClaim = {
        id: `claim:${artifact.filePath}:test:${idx}`,
        artifactId: artifactNodeId,
        filePath: artifact.filePath,
        startLine: test.location.startLine,
        endLine: test.location.endLine,
        sourceType: artifact.artifactType,
        rawSnippet: test.rawSnippet,
        subject,
        assertion: `Test '${test.title}' asserts: [${assertionsSummary}]`,
      };
      fileClaims.push(claim);
    });

    // Merge claims extracted during extractArtifactInformation with fileClaims
    const existingClaimsMap = new Map<string, ExtractedClaim>();
    artifact.extracted.claims.forEach((c) => existingClaimsMap.set(c.id, c));
    fileClaims.forEach((c) => existingClaimsMap.set(c.id, c));

    const combinedFileClaims = Array.from(existingClaimsMap.values());
    artifact.extracted.claims = combinedFileClaims;
    claims.push(...combinedFileClaims);

    // Build Nodes & Edges for Claims
    fileClaims.forEach((claim) => {
      // Claim Node
      nodes.push({
        id: claim.id,
        type: 'CLAIM',
        label: claim.assertion.slice(0, 40) + '...',
        data: { ...claim },
      });

      // Artifact -> Claim Edge
      edges.push({
        id: `edge:${artifactNodeId}->${claim.id}`,
        source: artifactNodeId,
        target: claim.id,
        relation: 'CONTAINS',
      });

      // Subject Node
      const subjectNodeId = `subject:${claim.subject}`;
      if (!subjectMap.has(subjectNodeId)) {
        subjectMap.add(subjectNodeId);
        nodes.push({
          id: subjectNodeId,
          type: 'SUBJECT',
          label: claim.subject,
          data: { subject: claim.subject },
        });
      }

      // Claim -> Subject Edge
      edges.push({
        id: `edge:${claim.id}->${subjectNodeId}`,
        source: claim.id,
        target: subjectNodeId,
        relation: 'ADDRESSES',
      });
    });
  });

  return {
    graph: { nodes, edges },
    claims,
  };
}
