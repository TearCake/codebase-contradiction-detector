import { NormalizedArtifact, ExtractedTestItem, ExtractedClaim } from '../../types/engine';

export function extractTestArtifacts(artifact: NormalizedArtifact): void {
  const testItems: ExtractedTestItem[] = [];
  const claims: ExtractedClaim[] = [];
  const lines = artifact.content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Match describe blocks or it/test blocks
    if (trimmed.startsWith('describe(') || trimmed.startsWith('it(') || trimmed.startsWith('test(')) {
      const match = trimmed.match(/(describe|it|test)\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (match) {
        const kind = match[1] as 'describe' | 'it' | 'test';
        const title = match[2];

        testItems.push({
          title,
          kind,
          assertions: [],
          location: { startLine: lineNum, endLine: lineNum },
          rawSnippet: trimmed,
        });
      }
    }

    // Match status assertions e.g. expect(response.status).toBe(403)
    if (line.includes('status') && line.includes('403')) {
      claims.push({
        id: `claim-${artifact.filePath}-test-status-${lineNum}`,
        artifactId: artifact.id,
        filePath: artifact.filePath,
        startLine: lineNum,
        endLine: lineNum,
        sourceType: 'TEST',
        rawSnippet: trimmed,
        subject: 'EXPIRED_TOKEN_RESPONSE',
        assertion: `Test asserts expired tokens return HTTP 403 Forbidden`,
        metadata: { statusCode: 403, kind: 'TEST_STATUS_ASSERTION' },
      });
    }
  });

  artifact.extracted.testItems = testItems;
  artifact.extracted.claims.push(...claims);
}
