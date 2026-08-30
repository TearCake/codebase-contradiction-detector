import { scanRepository, ScanResult } from './scanner';
import { extractArtifactInformation } from './extractor';
import { produceRepositorySummary } from './summary';
import { buildRepositoryContextGraph } from './graph';
import { evaluateRepositoryContradictions, evaluateRepositoryContradictionsAsync } from './evaluator';
import { LLMClient, LLMProviderConfig } from './llm/client';
import {
  NormalizedArtifact,
  RepositorySummary,
  RepositoryContextGraph,
  ContradictionFinding,
  ExtractedClaim,
  RepositoryInfo,
  AnalysisPipelineResult,
} from '../types/engine';

export async function runFullAnalysisPipelineAsync(repoPath: string, llmConfig?: LLMProviderConfig): Promise<AnalysisPipelineResult> {
  const llmClient = new LLMClient(llmConfig);

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

  // 5. Evaluate Contradictions (Async with LLM)
  const { findings, semanticMetrics } = await evaluateRepositoryContradictionsAsync(scanResult.artifacts, claims, llmClient);

  // 6. Enrich Graph
  enrichGraphWithFindings(graph, findings);

  // 7. Calculate Repository Health Score (0 - 100)
  const healthScore = calculateHealthScore(findings);

  const analysisMode = (semanticMetrics.status === 'COMPLETED' || semanticMetrics.status === 'RATE_LIMITED' || semanticMetrics.llmCallsMade > 0) 
    ? 'HYBRID' 
    : 'DETERMINISTIC_ONLY';

  return {
    scanResult,
    artifacts: scanResult.artifacts,
    summary,
    graph,
    claims,
    findings,
    healthScore,
    semanticAnalysis: semanticMetrics,
    analysisMode
  };
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

  // 5. Evaluate Contradictions (Sync)
  const findings = evaluateRepositoryContradictions(scanResult.artifacts, claims);

  // 6. Enrich Graph
  enrichGraphWithFindings(graph, findings);

  // 7. Calculate Repository Health Score
  const healthScore = calculateHealthScore(findings);

  return {
    scanResult,
    artifacts: scanResult.artifacts,
    summary,
    graph,
    claims,
    findings,
    healthScore,
    analysisMode: 'DETERMINISTIC_ONLY'
  };
}

function enrichGraphWithFindings(graph: RepositoryContextGraph, findings: ContradictionFinding[]): void {
  findings.forEach((finding) => {
    const distinctSubjects = new Set(finding.conflictingClaims.map((c) => c.subject));

    if (distinctSubjects.size > 1) {
      if (distinctSubjects.has(finding.subject)) {
        finding.subject = `logical_conflict:${finding.id}`;
      }

      const logicalSubjectId = `subject:${finding.subject}`;
      if (!graph.nodes.some((n) => n.id === logicalSubjectId)) {
        graph.nodes.push({
          id: logicalSubjectId,
          type: 'SUBJECT',
          label: finding.subject,
          data: { subject: finding.subject, isLogical: true },
        });
      }

      finding.conflictingClaims.forEach((claim) => {
        const edgeId = `edge:${claim.id}->${logicalSubjectId}`;
        if (!graph.edges.some((e) => e.id === edgeId)) {
          graph.edges.push({
            id: edgeId,
            source: claim.id,
            target: logicalSubjectId,
            relation: 'ADDRESSES',
          });
        }
      });
    }

    for (let i = 0; i < finding.conflictingClaims.length; i++) {
      for (let j = i + 1; j < finding.conflictingClaims.length; j++) {
        const c1 = finding.conflictingClaims[i];
        const c2 = finding.conflictingClaims[j];

        graph.edges.push({
          id: `edge:conflict:${c1.id}-${c2.id}`,
          source: c1.id,
          target: c2.id,
          relation: 'CONFLICTS_WITH',
        });
      }
    }
  });
}

function calculateHealthScore(findings: ContradictionFinding[]): number {
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

  return Math.max(0, Math.min(100, 100 - penalty));
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
export * from './llm/client';
export * from './llm/candidateMatcher';
export * from './llm/evidenceVerifier';
export * from './llm/semanticService';
