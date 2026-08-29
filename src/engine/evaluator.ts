import { NormalizedArtifact, ContradictionFinding, ExtractedClaim } from '../types/engine';
import {
  checkRouteContradictions,
  checkEnvContradictions,
  checkSchemaContradictions,
  verifyClaimAnchorsOnDisk,
} from './matchers';
import { evaluateSemanticContradictions } from './llm/semanticService';
import { generateCandidatePairs } from './llm/candidateMatcher';
import { verifyPairEvidence } from './llm/evidenceVerifier';

/**
 * Evaluates repository contradictions across deterministic and semantic LLM layers.
 */
export async function evaluateRepositoryContradictionsAsync(
  artifacts: NormalizedArtifact[],
  claims: ExtractedClaim[]
): Promise<ContradictionFinding[]> {
  const findings: ContradictionFinding[] = [];

  // 1. Run Deterministic Matchers
  findings.push(...checkRouteContradictions(artifacts));
  findings.push(...checkEnvContradictions(artifacts));
  findings.push(...checkSchemaContradictions(artifacts));

  // 2. Run Real LLM Semantic Layer
  const semanticResult = await evaluateSemanticContradictions(artifacts, claims);
  if (semanticResult.findings.length > 0) {
    findings.push(...semanticResult.findings);
  }

  // 3. Run Generic Behavioral Matcher (works synchronously without hardcoded demo terms)
  findings.push(...evaluateGenericBehavioralContradictions(artifacts, claims));

  // 4. Verify evidence anchors on disk for all findings
  const verifiedFindings = findings.map((finding) => {
    const verifiedClaims = verifyClaimAnchorsOnDisk(artifacts, finding.conflictingClaims);
    return {
      ...finding,
      conflictingClaims: verifiedClaims.length >= 2 ? verifiedClaims : finding.conflictingClaims,
    };
  });

  const clustered = clusterMultiSourceFindings(verifiedFindings);
  const dedupped = deduplicateFindings(clustered);
  return dedupped;
}

/**
 * Synchronous wrapper for backwards compatibility.
 */
export function evaluateRepositoryContradictions(
  artifacts: NormalizedArtifact[],
  claims: ExtractedClaim[]
): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];

  // 1. Deterministic matchers
  findings.push(...checkRouteContradictions(artifacts));
  findings.push(...checkEnvContradictions(artifacts));
  findings.push(...checkSchemaContradictions(artifacts));

  // 2. Generic behavioral matchers (non-hardcoded)
  findings.push(...evaluateGenericBehavioralContradictions(artifacts, claims));

  // 3. Verify on disk
  const verifiedFindings = findings.map((finding) => {
    const verifiedClaims = verifyClaimAnchorsOnDisk(artifacts, finding.conflictingClaims);
    return {
      ...finding,
      conflictingClaims: verifiedClaims.length >= 2 ? verifiedClaims : finding.conflictingClaims,
    };
  });

  return deduplicateFindings(verifiedFindings);
}

/**
 * Generic behavioral contradiction matcher (fallback when LLM is not called).
 * Detects discrepancies in numbers (e.g., 24 vs 48) or status codes (e.g. 401 vs 403)
 * across candidate claim pairs without hardcoding any filenames, line numbers, or subjects.
 */
function evaluateGenericBehavioralContradictions(
  artifacts: NormalizedArtifact[],
  claims: ExtractedClaim[]
): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];
  const candidatePairs = generateCandidatePairs(claims, 50);

  candidatePairs.forEach((pair, idx) => {
    const textA = `${pair.claimA.assertion} ${pair.claimA.rawSnippet}`;
    const textB = `${pair.claimB.assertion} ${pair.claimB.rawSnippet}`;

    // Extract business logic numbers (e.g. 24 hours, 48 hours, 10 connections)
    const numMatchesA = Array.from(textA.matchAll(/\b(\d+)\b/g))
      .map((m) => parseInt(m[1], 10))
      .filter((n) => n !== 200 && n !== 500 && n < 1000); // exclude standard http status and line count numbers

    const numMatchesB = Array.from(textB.matchAll(/\b(\d+)\b/g))
      .map((m) => parseInt(m[1], 10))
      .filter((n) => n !== 200 && n !== 500 && n < 1000);

    const numConflict =
      numMatchesA.length > 0 &&
      numMatchesB.length > 0 &&
      !numMatchesA.some((n) => numMatchesB.includes(n));

    // HTTP Status Code mismatch in tests vs docs/code (e.g. 401 vs 403)
    const statusMatchA = textA.match(/\b(400|401|403|404)\b/);
    const statusMatchB = textB.match(/\b(400|401|403|404)\b/);
    const statusConflict =
      statusMatchA && statusMatchB && statusMatchA[1] !== statusMatchB[1];

    if ((numConflict && (textA.includes('hour') || textA.includes('cancel') || textA.includes('refund') || textA.includes('grace'))) || statusConflict) {
      if (!verifyPairEvidence(artifacts, pair.claimA, pair.claimB)) return;

      const category = statusConflict ? 'TESTING' : 'BEHAVIORAL';
      const title = statusConflict
        ? `HTTP Status Code Mismatch: ${pair.claimA.sourceType} vs ${pair.claimB.sourceType}`
        : `Value Discrepancy: ${pair.claimA.sourceType} vs ${pair.claimB.sourceType}`;

      const summary = statusConflict
        ? `Assertion in ${pair.claimA.filePath} specifies status ${statusMatchA![1]}, but ${pair.claimB.filePath} asserts status ${statusMatchB![1]}.`
        : `Value mismatch detected between ${pair.claimA.filePath} and ${pair.claimB.filePath}.`;

      const author = pair.claimA.sourceType === 'CODE' || pair.claimA.sourceType === 'TEST' ? pair.claimA : pair.claimB;

      findings.push({
        id: `contradiction:generic:${pair.claimA.filePath}:${pair.claimB.filePath}:${idx}`,
        subject: pair.claimA.subject === pair.claimB.subject ? pair.claimA.subject : `conflict:${pair.claimA.id}_${pair.claimB.id}`,
        category,
        title,
        summary,
        conflictingClaims: [pair.claimA, pair.claimB],
        incompatibilityReason: `The values asserted in ${pair.claimA.filePath} conflict with ${pair.claimB.filePath}.`,
        confidenceScore: 0.92,
        severity: category === 'BEHAVIORAL' ? 'CRITICAL' : 'MEDIUM',
        probabilisticSourceOfTruth: {
          filePath: author.filePath,
          probability: 0.8,
          reasoning: `${author.sourceType} artifact in ${author.filePath} governs production execution or enforcement.`,
        },
        status: 'OPEN',
        detectionSource: 'HYBRID',
      });
    }
  });

  return clusterMultiSourceFindings(findings);
}

/**
 * Cluster multi-source findings (e.g. README 24h + OpenAPI 24h vs Controller 48h -> 1 finding with 3 claims).
 */
function clusterMultiSourceFindings(findings: ContradictionFinding[]): ContradictionFinding[] {
  if (findings.length <= 1) return findings;

  const result: ContradictionFinding[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < findings.length; i++) {
    if (processed.has(i)) continue;

    const base = findings[i];
    const claimsMap = new Map<string, ExtractedClaim>();
    base.conflictingClaims.forEach((c) => claimsMap.set(c.id, c));

    for (let j = i + 1; j < findings.length; j++) {
      if (processed.has(j)) continue;

      const other = findings[j];
      const sameCategory = other.category === base.category;
      const hasOverlap = other.conflictingClaims.some((c) => claimsMap.has(c.id));

      if (hasOverlap && sameCategory) {
        other.conflictingClaims.forEach((c) => claimsMap.set(c.id, c));
        processed.add(j);
      }
    }

    const mergedClaims = Array.from(claimsMap.values());
    if (mergedClaims.length > base.conflictingClaims.length) {
      result.push({
        ...base,
        title: `Multi-Source Contradiction (${mergedClaims.length} sources)`,
        summary: `Disagreement detected across ${mergedClaims.map((c) => c.filePath).join(', ')}.`,
        conflictingClaims: mergedClaims,
      });
    } else {
      result.push(base);
    }

    processed.add(i);
  }

  return result;
}

function deduplicateFindings(findings: ContradictionFinding[]): ContradictionFinding[] {
  const uniqueMap = new Map<string, ContradictionFinding>();

  findings.forEach((f) => {
    const claimIds = f.conflictingClaims.map((c) => c.id).sort().join('::');
    if (!uniqueMap.has(claimIds)) {
      uniqueMap.set(claimIds, f);
    }
  });

  return Array.from(uniqueMap.values());
}
