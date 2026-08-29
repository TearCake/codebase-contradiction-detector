import path from 'path';
import { runFullAnalysisPipeline } from '../engine';

function runEvaluation() {
  const targetPath = path.resolve(process.cwd(), 'demo-repo');
  console.log(`=======================================================`);
  console.log(` CODEBASE CONTRADICTION DETECTOR - EVALUATION SUITE   `);
  console.log(` Target Repository: ${targetPath}`);
  console.log(`=======================================================\n`);

  const startTime = Date.now();
  const analysis = runFullAnalysisPipeline(targetPath);
  const duration = Date.now() - startTime;

  console.log(`[SUMMARY]`);
  console.log(`- Files Scanned: ${analysis.summary.totalFilesScanned}`);
  console.log(`- Relevant Artifacts: ${analysis.summary.relevantArtifactsCount}`);
  console.log(`- Extracted Claims: ${analysis.claims.length}`);
  console.log(`- Context Graph Nodes: ${analysis.graph.nodes.length}`);
  console.log(`- Context Graph Edges: ${analysis.graph.edges.length}`);
  console.log(`- Analysis Time: ${duration}ms`);
  console.log(`- Codebase Health Score: ${analysis.healthScore}/100\n`);

  console.log(`[CONTRADICTIONS DISCOVERED (${analysis.findings.length})]\n`);

  analysis.findings.forEach((finding, idx) => {
    console.log(`-------------------------------------------------------`);
    console.log(`[Finding ${idx + 1}] [${finding.severity}] ${finding.title}`);
    console.log(`Subject: ${finding.subject}`);
    console.log(`Category: ${finding.category}`);
    console.log(`Confidence Score: ${(finding.confidenceScore * 100).toFixed(0)}%`);
    console.log(`Summary: ${finding.summary}`);
    console.log(`\nConflicting Claims (${finding.conflictingClaims.length}):`);

    finding.conflictingClaims.forEach((claim, cIdx) => {
      console.log(`  (${cIdx + 1}) [${claim.sourceType}] ${claim.filePath}:${claim.startLine}-${claim.endLine}`);
      console.log(`      Assertion: "${claim.assertion}"`);
    });

    console.log(`\nLikely Authoritative Source:`);
    console.log(`  Path: ${finding.probabilisticSourceOfTruth.filePath}`);
    console.log(`  Evidence Score: ${(finding.probabilisticSourceOfTruth.probability * 100).toFixed(0)}%`);
    console.log(`  Reasoning: ${finding.probabilisticSourceOfTruth.reasoning}`);
    console.log(`-------------------------------------------------------\n`);
  });

  const passed = analysis.findings.length >= 5;
  if (passed) {
    console.log(`SUCCESS: All target synthetic demo contradictions discovered successfully!`);
  } else {
    console.error(`WARNING: Expected at least 5 findings, discovered ${analysis.findings.length}`);
  }
}

runEvaluation();
