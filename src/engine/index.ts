import { scanRepository, ScanResult } from './scanner';
import { extractArtifactInformation } from './extractor';
import { produceRepositorySummary } from './summary';
import { buildRepositoryContextGraph } from './graph';
import { evaluateRepositoryContradictions } from './evaluator';
import {
  NormalizedArtifact,
  RepositorySummary,
  RepositoryContextGraph,
  ContradictionFinding,
  ExtractedClaim,
} from '../types/engine';

export interface AnalysisPipelineResult {
  scanResult: ScanResult;
  artifacts: NormalizedArtifact[];
  summary: RepositorySummary;
  graph: RepositoryContextGraph;
  claims: ExtractedClaim[];
  findings: ContradictionFinding[];
  healthScore: number;
}

export function runFullAnalysisPipeline(repoPath: string): AnalysisPipelineResult {
  // 1. Scan Repository
  const scanResult = scanRepository(repoPath);

  // 2. Extract Artifacts
  scanResult.artifacts.forEach((artifact) => {
    extractArtifactInformation(artifact);
  });

  // 3. Produce Repository Summary
  const summary = produceRepositorySummary(scanResult);

  // 4. Build Context Graph & Claims
  const { graph, claims } = buildRepositoryContextGraph(scanResult.artifacts);

  // 5. Evaluate Contradictions
  const findings = evaluateRepositoryContradictions(scanResult.artifacts, claims);

  // 6. Calculate Repository Health Score (0 - 100)
  // Deduct based on severity of findings
  let penalty = 0;
  findings.forEach((f) => {
    switch (f.severity) {
      case 'CRITICAL':
        penalty += 20;
        break;
      case 'HIGH':
        penalty += 12;
        break;
      case 'MEDIUM':
        penalty += 6;
        break;
      case 'LOW':
        penalty += 2;
        break;
    }
  });

  const healthScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    scanResult,
    artifacts: scanResult.artifacts,
    summary,
    graph,
    claims,
    findings,
    healthScore,
  };
}

// Backwards compatibility export
export function runIngestionPipeline(repoPath: string) {
  const result = runFullAnalysisPipeline(repoPath);
  return {
    scanResult: result.scanResult,
    artifacts: result.artifacts,
    summary: result.summary,
  };
}

export * from './scanner';
export * from './extractor';
export * from './summary';
export * from './graph';
export * from './matchers';
export * from './evaluator';
