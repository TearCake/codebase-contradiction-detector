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

  // 6. Enrich graph with CONFLICTS_WITH edges and logical subjects for findings
  findings.forEach((finding) => {
    // Check if the claims have different subjects (Case B mismatch)
    const distinctSubjects = new Set(finding.conflictingClaims.map(c => c.subject));
    
    // If it's a structural mismatch (multiple distinct subjects), update the finding subject
    // to be a logical comparison node if it isn't already handled.
    if (distinctSubjects.size > 1) {
      // Ensure the finding's subject is distinct from the individual claim subjects
      if (distinctSubjects.has(finding.subject)) {
        finding.subject = `logical_conflict:${finding.id}`;
      }
      
      // Add the logical subject node if it doesn't exist
      const logicalSubjectId = `subject:${finding.subject}`;
      if (!graph.nodes.some(n => n.id === logicalSubjectId)) {
        graph.nodes.push({
          id: logicalSubjectId,
          type: 'SUBJECT',
          label: finding.subject,
          data: { subject: finding.subject, isLogical: true },
        });
      }
      
      // Link the differing subjects or claims to this logical node
      finding.conflictingClaims.forEach(claim => {
        const edgeId = `edge:${claim.id}->${logicalSubjectId}`;
        if (!graph.edges.some(e => e.id === edgeId)) {
          graph.edges.push({
            id: edgeId,
            source: claim.id,
            target: logicalSubjectId,
            relation: 'ADDRESSES',
          });
        }
      });
    }

    // Add CONFLICTS_WITH edges between all conflicting claims
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

  // 7. Calculate Repository Health Score (0 - 100)
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
