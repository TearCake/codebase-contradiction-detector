import { scanRepository, ScanResult } from './scanner';
import { extractArtifactInformation } from './extractor';
import { produceRepositorySummary } from './summary';
import { NormalizedArtifact, RepositorySummary } from '../types/engine';

export interface IngestionPipelineResult {
  scanResult: ScanResult;
  artifacts: NormalizedArtifact[];
  summary: RepositorySummary;
}

export function runIngestionPipeline(repoPath: string): IngestionPipelineResult {
  const scanResult = scanRepository(repoPath);

  scanResult.artifacts.forEach(artifact => {
    extractArtifactInformation(artifact);
  });

  const summary = produceRepositorySummary(scanResult);

  return {
    scanResult,
    artifacts: scanResult.artifacts,
    summary,
  };
}

export * from './scanner';
export * from './extractor';
export * from './summary';

