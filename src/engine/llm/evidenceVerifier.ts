import { NormalizedArtifact, ExtractedClaim } from '../../types/engine';

export interface EvidenceVerificationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Real Evidence Verification Service:
 * Verifies both claims in a candidate contradiction against the actual repository files on disk.
 */
export function verifyClaimEvidence(
  artifacts: NormalizedArtifact[],
  claim: ExtractedClaim
): EvidenceVerificationResult {
  const artifact = artifacts.find((a) => a.filePath === claim.filePath);
  if (!artifact) {
    return { isValid: false, reason: `File '${claim.filePath}' does not exist in repository.` };
  }

  // 1. Line range validation
  if (claim.startLine < 1 || claim.endLine < claim.startLine) {
    return { isValid: false, reason: `Invalid line range [${claim.startLine}-${claim.endLine}] in '${claim.filePath}'.` };
  }

  if (claim.startLine > artifact.lineCount + 1) {
    return { isValid: false, reason: `Start line ${claim.startLine} exceeds total lines (${artifact.lineCount}) in '${claim.filePath}'.` };
  }

  // 2. Snippet verification against file content
  if (claim.rawSnippet && claim.rawSnippet.trim().length > 0) {
    const fileLines = artifact.content.split('\n');
    const startIdx = Math.max(0, claim.startLine - 1);
    const endIdx = Math.min(fileLines.length, claim.endLine);
    const actualSnippetLines = fileLines.slice(startIdx, endIdx).join('\n');

    // Normalize whitespace to verify match
    const normActual = actualSnippetLines.replace(/\s+/g, ' ').trim();
    const normClaim = claim.rawSnippet.replace(/\s+/g, ' ').trim();
    const normContent = artifact.content.replace(/\s+/g, ' ').trim();

    if (!normActual.includes(normClaim) && !normClaim.includes(normActual) && !normContent.includes(normClaim)) {
      return {
        isValid: false,
        reason: `Raw snippet does not match file content at lines ${claim.startLine}-${claim.endLine} in '${claim.filePath}'.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Verify both claims in a pair.
 */
export function verifyPairEvidence(
  artifacts: NormalizedArtifact[],
  claimA: ExtractedClaim,
  claimB: ExtractedClaim
): boolean {
  const resA = verifyClaimEvidence(artifacts, claimA);
  const resB = verifyClaimEvidence(artifacts, claimB);

  return resA.isValid && resB.isValid;
}
