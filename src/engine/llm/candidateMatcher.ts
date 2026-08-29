import { ExtractedClaim } from '../../types/engine';

export interface CandidatePair {
  claimA: ExtractedClaim;
  claimB: ExtractedClaim;
  pairingScore: number;
  matchReason: string;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'can', 'should', 'must', 'have', 'been', 'with',
  'topic', 'claim', 'artifact', 'file', 'code', 'docs', 'spec', 'config', 'test',
  'const', 'var', 'let', 'function', 'export', 'import', 'return', 'class',
  'default', 'type', 'interface', 'async', 'await', 'string', 'number', 'boolean',
  'true', 'false', 'null', 'undefined', 'src', 'app', 'index', 'main',
]);

/**
 * Tokenizes text into normalized lowercase alphanumeric keywords.
 * Splits camelCase identifiers and performs basic stemming.
 */
export function tokenizeText(text: string): Set<string> {
  // Split camelCase identifiers e.g. maxGraceHours -> max Grace Hours and replace underscores/dashes with spaces
  const camelSplit = text.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.\-\/]/g, ' ');

  const rawTokens = camelSplit
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const tokens = new Set<string>();

  for (const t of rawTokens) {
    tokens.add(t);
    // Simple stemming for plurals and verb endings
    if (t.endsWith('s') && t.length > 3) tokens.add(t.slice(0, -1));
    if (t.endsWith('ed') && t.length > 4) tokens.add(t.endsWith('abled') ? t.slice(0, -1) : t.slice(0, -2));
    if (t.endsWith('ing') && t.length > 5) tokens.add(t.slice(0, -3));
    if (t === 'enabled' || t === 'enabling' || t === 'enable') tokens.add('enable');
    if (t === 'limiting' || t === 'limited' || t === 'limit') tokens.add('limit');
  }

  return tokens;
}

export function computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Generic candidate pairing logic.
 * Pre-filters claims to pair those from DIFFERENT source types or files that share domain context.
 */
export function generateCandidatePairs(
  claims: ExtractedClaim[],
  maxPairs: number = 30
): CandidatePair[] {
  const candidatePairs: CandidatePair[] = [];

  const claimsWithTokens = claims.map((c) => ({
    claim: c,
    tokens: tokenizeText(`${c.subject} ${c.assertion} ${c.symbolName || ''} ${c.rawSnippet}`),
  }));

  for (let i = 0; i < claimsWithTokens.length; i++) {
    for (let j = i + 1; j < claimsWithTokens.length; j++) {
      const itemA = claimsWithTokens[i];
      const itemB = claimsWithTokens[j];
      const claimA = itemA.claim;
      const claimB = itemB.claim;

      // 1. Must come from different source types or different files
      if (claimA.sourceType === claimB.sourceType && claimA.filePath === claimB.filePath) {
        continue;
      }

      // 2. Exact match on subject
      if (claimA.subject === claimB.subject && claimA.subject !== 'doc:general' && claimA.subject !== 'test:general') {
        candidatePairs.push({
          claimA,
          claimB,
          pairingScore: 1.0,
          matchReason: `Exact subject match: ${claimA.subject}`,
        });
        continue;
      }

      // 3. Token similarity cross-check
      let sharedDomainKeywords = 0;
      for (const token of itemA.tokens) {
        if (token.length >= 4 && itemB.tokens.has(token)) {
          sharedDomainKeywords++;
        }
      }

      const tokenSim = computeJaccardSimilarity(itemA.tokens, itemB.tokens);

      if (sharedDomainKeywords >= 1 || tokenSim >= 0.12) {
        candidatePairs.push({
          claimA,
          claimB,
          pairingScore: Math.max(tokenSim, sharedDomainKeywords * 0.15),
          matchReason: `Domain keyword overlap (${sharedDomainKeywords} shared tokens)`,
        });
      }
    }
  }

  candidatePairs.sort((a, b) => b.pairingScore - a.pairingScore);

  const uniquePairs: CandidatePair[] = [];
  const seenPairKeys = new Set<string>();

  for (const pair of candidatePairs) {
    const key = [pair.claimA.id, pair.claimB.id].sort().join('::');
    if (!seenPairKeys.has(key)) {
      seenPairKeys.add(key);
      uniquePairs.push(pair);
    }
    if (uniquePairs.length >= maxPairs) break;
  }

  return uniquePairs;
}
