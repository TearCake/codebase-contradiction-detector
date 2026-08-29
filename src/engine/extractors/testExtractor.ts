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
  });

  artifact.extracted.testItems = testItems;
  artifact.extracted.claims = claims;
}
