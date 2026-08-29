import { NormalizedArtifact, ExtractedClaim, ContradictionFinding } from '../../types/engine';
import { LLMClient, LLMComparisonResponse } from './client';
import { generateCandidatePairs } from './candidateMatcher';
import { verifyPairEvidence } from './evidenceVerifier';

export interface SemanticAnalysisResult {
  findings: ContradictionFinding[];
  candidatePairsEvaluated: number;
  llmCallsMade: number;
  contradictionsProposed: number;
  acceptedAfterVerification: number;
  duplicatesRemoved: number;
  llmAvailable: boolean;
}

export async function evaluateSemanticContradictions(
  artifacts: NormalizedArtifact[],
  claims: ExtractedClaim[],
  options?: { client?: LLMClient; maxPairs?: number }
): Promise<SemanticAnalysisResult> {
  const client = options?.client || new LLMClient();
  const llmAvailable = client.isAvailable();

  const candidatePairs = generateCandidatePairs(claims, options?.maxPairs || 25);

  let llmCallsMade = 0;
  let contradictionsProposed = 0;
  let acceptedAfterVerification = 0;
  let duplicatesRemoved = 0;

  const rawFindings: ContradictionFinding[] = [];

  for (const pair of candidatePairs) {
    if (!llmAvailable) break;

    llmCallsMade++;
    const llmRes: LLMComparisonResponse | null = await client.compareClaims({
      claimA: {
        sourceType: pair.claimA.sourceType,
        filePath: pair.claimA.filePath,
        subject: pair.claimA.subject,
        assertion: pair.claimA.assertion,
        rawSnippet: pair.claimA.rawSnippet,
      },
      claimB: {
        sourceType: pair.claimB.sourceType,
        filePath: pair.claimB.filePath,
        subject: pair.claimB.subject,
        assertion: pair.claimB.assertion,
        rawSnippet: pair.claimB.rawSnippet,
      },
    });

    if (!llmRes || !llmRes.sameSubject || !llmRes.contradictory) {
      continue;
    }

    contradictionsProposed++;

    // Evidence Verification
    const isVerified = verifyPairEvidence(artifacts, pair.claimA, pair.claimB);
    if (!isVerified) {
      console.warn(`[SemanticService] Evidence verification failed for pair ${pair.claimA.id} ↔ ${pair.claimB.id}`);
      continue;
    }

    acceptedAfterVerification++;

    // Determine Probabilistic Source of Truth
    const sourceOfTruth = calculateLikelyAuthoritativeSource(pair.claimA, pair.claimB, llmRes.suggestedAuthoritativeSource);

    const findingId = `contradiction:semantic:${pair.claimA.filePath}:${pair.claimB.filePath}:${rawFindings.length + 1}`;
    const subject = pair.claimA.subject === pair.claimB.subject ? pair.claimA.subject : `semantic_conflict:${pair.claimA.id}_${pair.claimB.id}`;

    rawFindings.push({
      id: findingId,
      subject,
      category: llmRes.category || 'BEHAVIORAL',
      title: llmRes.title || `Semantic Contradiction: ${pair.claimA.sourceType} vs ${pair.claimB.sourceType}`,
      summary: llmRes.summary || `Semantic conflict detected between ${pair.claimA.filePath} and ${pair.claimB.filePath}.`,
      conflictingClaims: [pair.claimA, pair.claimB],
      incompatibilityReason: llmRes.incompatibilityReason || `The assertions in ${pair.claimA.filePath} and ${pair.claimB.filePath} cannot simultaneously be true.`,
      confidenceScore: llmRes.confidence || 0.85,
      severity: llmRes.confidence > 0.9 ? 'CRITICAL' : 'HIGH',
      probabilisticSourceOfTruth: sourceOfTruth,
      status: 'OPEN',
    });
  }

  // Deduplicate and Cluster Multi-Source Discrepancies
  const clusteredFindings = clusterAndDeduplicateFindings(rawFindings);
  duplicatesRemoved = rawFindings.length - clusteredFindings.length;

  return {
    findings: clusteredFindings,
    candidatePairsEvaluated: candidatePairs.length,
    llmCallsMade,
    contradictionsProposed,
    acceptedAfterVerification,
    duplicatesRemoved,
    llmAvailable,
  };
}

/**
 * Calculates likely authoritative source based on source type heuristics and LLM suggestion.
 */
function calculateLikelyAuthoritativeSource(
  claimA: ExtractedClaim,
  claimB: ExtractedClaim,
  llmSuggestion?: 'CLAIM_A' | 'CLAIM_B' | 'UNKNOWN'
): { filePath: string; probability: number; reasoning: string } {
  // Source priority weight: CODE (5) > TEST (4) > SPEC (3) > CONFIG (2) > DOCS (1)
  const weights: Record<string, number> = {
    CODE: 5,
    TEST: 4,
    SPEC: 3,
    CONFIG: 2,
    DOCS: 1,
  };

  const weightA = weights[claimA.sourceType] || 1;
  const weightB = weights[claimB.sourceType] || 1;

  if (weightA > weightB) {
    return {
      filePath: claimA.filePath,
      probability: 0.85,
      reasoning: `${claimA.sourceType} source in ${claimA.filePath} governs production execution or enforcement over ${claimB.sourceType}.`,
    };
  } else if (weightB > weightA) {
    return {
      filePath: claimB.filePath,
      probability: 0.85,
      reasoning: `${claimB.sourceType} source in ${claimB.filePath} governs production execution or enforcement over ${claimA.sourceType}.`,
    };
  } else {
    if (llmSuggestion === 'CLAIM_A') {
      return {
        filePath: claimA.filePath,
        probability: 0.75,
        reasoning: `Semantic analysis determined ${claimA.filePath} as the likely authoritative source.`,
      };
    } else {
      return {
        filePath: claimB.filePath,
        probability: 0.75,
        reasoning: `Semantic analysis determined ${claimB.filePath} as the likely authoritative source.`,
      };
    }
  }
}

/**
 * Merges pairwise findings that share conflicting claims into multi-source contradiction clusters.
 */
function clusterAndDeduplicateFindings(findings: ContradictionFinding[]): ContradictionFinding[] {
  if (findings.length <= 1) return findings;

  const result: ContradictionFinding[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < findings.length; i++) {
    if (processedIndices.has(i)) continue;

    const base = findings[i];
    const claimsMap = new Map<string, ExtractedClaim>();
    base.conflictingClaims.forEach((c) => claimsMap.set(c.id, c));

    // Look for other findings sharing overlapping claims
    for (let j = i + 1; j < findings.length; j++) {
      if (processedIndices.has(j)) continue;

      const other = findings[j];
      const hasOverlap = other.conflictingClaims.some((c) => claimsMap.has(c.id));

      if (hasOverlap) {
        // Merge claims into cluster
        other.conflictingClaims.forEach((c) => claimsMap.set(c.id, c));
        processedIndices.add(j);
      }
    }

    const mergedClaims = Array.from(claimsMap.values());
    if (mergedClaims.length > base.conflictingClaims.length) {
      result.push({
        ...base,
        title: `Multi-Source Contradiction (${mergedClaims.length} artifacts)`,
        summary: `Disagreement detected across ${mergedClaims.map((c) => c.filePath).join(', ')}.`,
        conflictingClaims: mergedClaims,
      });
    } else {
      result.push(base);
    }

    processedIndices.add(i);
  }

  return result;
}
