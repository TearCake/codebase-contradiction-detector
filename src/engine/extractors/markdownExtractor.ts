import { NormalizedArtifact, ExtractedMarkdownSection, ExtractedClaim } from '../../types/engine';

export function extractMarkdownArtifacts(artifact: NormalizedArtifact): void {
  const markdownSections: ExtractedMarkdownSection[] = [];
  const claims: ExtractedClaim[] = [];
  const lines = artifact.content.split('\n');

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockStartLine = 1;
  let codeBlockLines: string[] = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Code Block tracking
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockStartLine = lineNum;
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        markdownSections.push({
          type: 'code_block',
          language: codeBlockLang || undefined,
          text: codeBlockLines.join('\n'),
          location: { startLine: codeBlockStartLine, endLine: lineNum },
          rawSnippet: codeBlockLines.slice(0, 5).join('\n'),
        });
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // Heading tracking
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        markdownSections.push({
          type: 'heading',
          level,
          text,
          location: { startLine: lineNum, endLine: lineNum },
          rawSnippet: trimmed,
        });
        return;
      }
    }

    // Paragraph tracking
    if (trimmed.length > 0) {
      markdownSections.push({
        type: 'paragraph',
        text: trimmed,
        location: { startLine: lineNum, endLine: lineNum },
        rawSnippet: trimmed,
      });

      // Generic Claim Extraction from markdown paragraphs
      // 1. Endpoint path mentions e.g., `POST /api/v1/auth/login`
      const routeMatch = line.match(/(POST|GET|PUT|DELETE|PATCH)\s+(\/api\/[a-zA-Z0-9_\/]+)/i);
      if (routeMatch) {
        const method = routeMatch[1].toUpperCase();
        const routePath = routeMatch[2];

        claims.push({
          id: `claim-${artifact.filePath}-doc-route-${lineNum}`,
          artifactId: artifact.id,
          filePath: artifact.filePath,
          startLine: lineNum,
          endLine: lineNum,
          sourceType: 'DOCS',
          rawSnippet: trimmed,
          subject: `route:${method} ${routePath}`,
          assertion: `Documentation claims endpoint exists at: ${method} ${routePath}`,
          symbolName: routePath,
          metadata: { method, routePath, kind: 'DOC_ROUTE_CLAIM' },
        });
      }

      // 2. Env var key mentions e.g. ENABLE_RATE_LIMITING=true
      const envMatch = line.match(/([A-Z0-9_]{3,})=([a-zA-Z0-9_]+)/);
      if (envMatch) {
        const key = envMatch[1];
        const value = envMatch[2];
        claims.push({
          id: `claim-${artifact.filePath}-doc-env-${lineNum}`,
          artifactId: artifact.id,
          filePath: artifact.filePath,
          startLine: lineNum,
          endLine: lineNum,
          sourceType: 'DOCS',
          rawSnippet: trimmed,
          subject: `env:${key}`,
          assertion: `Documentation references environment setting ${key}=${value}`,
          symbolName: key,
          metadata: { key, value, kind: 'DOC_ENV_CLAIM' },
        });
      }
    }
  });

  artifact.extracted.markdownSections = markdownSections;
  artifact.extracted.claims = claims;
}
