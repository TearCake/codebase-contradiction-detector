import dotenv from 'dotenv';
import { NormalizedArtifact, ExtractedEnvRef, ExtractedClaim } from '../../types/engine';

export function extractEnvArtifacts(artifact: NormalizedArtifact): void {
  const envRefs: ExtractedEnvRef[] = [];
  const claims: ExtractedClaim[] = [];

  const parsed = dotenv.parse(artifact.content);
  const lines = artifact.content.split('\n');

  for (const [key, value] of Object.entries(parsed)) {
    const lineIndex = lines.findIndex(l => l.trim().startsWith(key)) + 1 || 1;

    envRefs.push({
      name: key,
      valueOrDefault: value,
      location: { startLine: lineIndex, endLine: lineIndex },
      rawSnippet: `${key}=${value}`,
      isDefinition: true,
    });

    claims.push({
      id: `claim-${artifact.filePath}-env-${key}`,
      artifactId: artifact.id,
      filePath: artifact.filePath,
      startLine: lineIndex,
      endLine: lineIndex,
      sourceType: 'CONFIG',
      rawSnippet: `${key}=${value}`,
      subject: `ENV_VAR:${key}`,
      assertion: `Environment configuration file defines key ${key}=${value}`,
      symbolName: key,
      metadata: { key, value, kind: 'ENV_KEY_DECLARATION' },
    });
  }

  artifact.extracted.envRefs = envRefs;
  artifact.extracted.claims.push(...claims);
}
