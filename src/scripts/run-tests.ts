import path from 'path';
import { parseAndValidateLLMResponse } from '../engine/llm/client';
import { generateCandidatePairs, tokenizeText, computeJaccardSimilarity } from '../engine/llm/candidateMatcher';
import { verifyClaimEvidence, verifyPairEvidence } from '../engine/llm/evidenceVerifier';
import { evaluateSemanticContradictions } from '../engine/llm/semanticService';
import { NormalizedArtifact, ExtractedClaim } from '../types/engine';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASSED: ${testName}`);
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
  }
}

async function runAllUnitTests() {
  console.log(`=======================================================`);
  console.log(` RUNNING UNIT & INTEGRATION TEST SUITE`);
  console.log(`=======================================================\n`);

  // SECTION 1: LLM Result Parsing
  console.log(`[1. LLM Response Parsing Tests]`);

  const validJson = JSON.stringify({
    sameSubject: true,
    contradictory: true,
    confidence: 0.95,
    category: 'BEHAVIORAL',
    title: 'Grace Period Mismatch',
    summary: 'README states 24h refund window while controller enforces 48h.',
    incompatibilityReason: 'Predicate mismatch between 24h and 48h.',
    suggestedAuthoritativeSource: 'CLAIM_B',
  });

  const parsedValid = parseAndValidateLLMResponse(validJson);
  assert(parsedValid !== null && parsedValid.sameSubject === true && parsedValid.confidence === 0.95, 'Valid JSON correctly parsed');

  const parsedCodeFence = parseAndValidateLLMResponse(`\`\`\`json\n${validJson}\n\`\`\``);
  assert(parsedCodeFence !== null && parsedCodeFence.sameSubject === true, 'Markdown code fence stripped and parsed');

  const parsedMalformed = parseAndValidateLLMResponse(`{ "sameSubject": true, invalid json }`);
  assert(parsedMalformed === null, 'Malformed JSON rejected gracefully');

  const parsedMissingFields = parseAndValidateLLMResponse(JSON.stringify({ title: 'missing flags' }));
  assert(parsedMissingFields === null, 'Missing required boolean fields rejected');

  const parsedBadConfidence = parseAndValidateLLMResponse(JSON.stringify({ sameSubject: true, contradictory: true, confidence: 'invalid' }));
  assert(parsedBadConfidence !== null && parsedBadConfidence.confidence === 0.8, 'Invalid confidence defaults safely');

  console.log('');

  // SECTION 2: Candidate Matching
  console.log(`[2. Candidate Matching Tests]`);

  const claims: ExtractedClaim[] = [
    {
      id: 'claim-1',
      artifactId: 'art-1',
      filePath: 'README.md',
      startLine: 1,
      endLine: 5,
      sourceType: 'DOCS',
      rawSnippet: 'Cancel active subscription within 24 hours for full refund.',
      subject: 'topic:subscription_cancel',
      assertion: '24 hour cancellation grace period',
    },
    {
      id: 'claim-2',
      artifactId: 'art-2',
      filePath: 'src/controllers/subscription.ts',
      startLine: 10,
      endLine: 20,
      sourceType: 'CODE',
      rawSnippet: 'const maxGraceHours = 48;\nif (elapsedHours > maxGraceHours) return res.status(400);',
      subject: 'topic:subscription_cancel',
      assertion: 'Enforces 48 hour max grace hours threshold',
    },
    {
      id: 'claim-3',
      artifactId: 'art-3',
      filePath: 'src/config/unrelated.ts',
      startLine: 1,
      endLine: 2,
      sourceType: 'CODE',
      rawSnippet: 'export const themeColor = "blue";',
      subject: 'topic:theme_ui',
      assertion: 'Default UI theme color is blue',
    },
  ];

  const pairs = generateCandidatePairs(claims);
  assert(pairs.length === 1, 'Only related candidate claims are paired');
  assert(
    (pairs[0].claimA.id === 'claim-1' && pairs[0].claimB.id === 'claim-2') ||
      (pairs[0].claimA.id === 'claim-2' && pairs[0].claimB.id === 'claim-1'),
    'Related claims pair correctly matched'
  );

  console.log('');

  // SECTION 3: Evidence Safety Verification
  console.log(`[3. Evidence Safety Verification Tests]`);

  const mockArtifacts: NormalizedArtifact[] = [
    {
      id: 'art-1',
      filePath: 'README.md',
      absolutePath: '/fake/README.md',
      artifactType: 'DOCS',
      format: 'markdown',
      content: 'Line 1\nLine 2\nCancel active subscription within 24 hours for full refund.\nLine 4',
      lineCount: 4,
      size: 100,
      metadata: {},
      extracted: {
        symbols: [], imports: [], routes: [], envRefs: [], openApiEndpoints: [], markdownSections: [], testItems: [], claims: [],
      },
    },
    {
      id: 'art-2',
      filePath: 'src/controllers/subscription.ts',
      absolutePath: '/fake/src/controllers/subscription.ts',
      artifactType: 'CODE',
      format: 'typescript',
      content: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nconst maxGraceHours = 48;\nif (elapsedHours > maxGraceHours) return res.status(400);',
      lineCount: 20,
      size: 200,
      metadata: {},
      extracted: {
        symbols: [], imports: [], routes: [], envRefs: [], openApiEndpoints: [], markdownSections: [], testItems: [], claims: [],
      },
    },
  ];

  const validClaim: ExtractedClaim = {
    id: 'c1',
    artifactId: 'art-1',
    filePath: 'README.md',
    startLine: 3,
    endLine: 3,
    sourceType: 'DOCS',
    rawSnippet: 'Cancel active subscription within 24 hours for full refund.',
    subject: 'test',
    assertion: 'test',
  };

  const resValid = verifyClaimEvidence(mockArtifacts, validClaim);
  assert(resValid.isValid === true, 'Valid snippet & line range passes evidence check');

  const invalidLineClaim: ExtractedClaim = {
    ...validClaim,
    startLine: 99,
    endLine: 100,
  };

  const resInvalidLine = verifyClaimEvidence(mockArtifacts, invalidLineClaim);
  assert(resInvalidLine.isValid === false, 'Out-of-range line fails evidence check');

  const invalidSnippetClaim: ExtractedClaim = {
    ...validClaim,
    startLine: 1,
    endLine: 2,
    rawSnippet: 'Non-existent text in file',
  };

  const resInvalidSnippet = verifyClaimEvidence(mockArtifacts, invalidSnippetClaim);
  assert(resInvalidSnippet.isValid === false, 'Mismatch snippet fails evidence check');

  const missingFileClaim: ExtractedClaim = {
    ...validClaim,
    filePath: 'non_existent_file.ts',
  };

  const resMissingFile = verifyClaimEvidence(mockArtifacts, missingFileClaim);
  assert(resMissingFile.isValid === false, 'Missing file fails evidence check');

  console.log('');

  // SECTION 4: Mocked Semantic Behavior Scenarios
  console.log(`[4. Mocked LLM Semantic Behavior Tests]`);

  // Mock LLM Client with mock behavior
  class MockLLMClient {
    public isAvailable() { return true; }
    public async compareClaims(req: any) {
      const textA = req.claimA.assertion + ' ' + req.claimA.rawSnippet;
      const textB = req.claimB.assertion + ' ' + req.claimB.rawSnippet;

      // 1. True Contradiction (24h vs 48h)
      if (textA.includes('24') && textB.includes('48')) {
        return {
          sameSubject: true,
          contradictory: true,
          confidence: 0.98,
          category: 'BEHAVIORAL' as const,
          title: 'Grace Period Discrepancy',
          summary: '24 hours vs 48 hours conflict',
          incompatibilityReason: '24 hours contradicts 48 hours',
          suggestedAuthoritativeSource: 'CLAIM_B' as const,
        };
      }

      // 2. Equivalent Wording (No contradiction)
      if (textA.includes('retrieves profile') && textB.includes('fetches user info')) {
        return {
          sameSubject: true,
          contradictory: false,
          confidence: 0.1,
        };
      }

      // 3. Different Subjects
      if (req.claimA.subject !== req.claimB.subject) {
        return {
          sameSubject: false,
          contradictory: false,
          confidence: 0.0,
        };
      }

      return null;
    }
  }

  const mockLLM = new MockLLMClient() as any;

  // Scenario 1: True Contradiction
  const trueContradictionResult = await evaluateSemanticContradictions(
    mockArtifacts,
    [claims[0], claims[1]],
    { client: mockLLM }
  );
  assert(trueContradictionResult.findings.length === 1, 'True contradiction correctly proposed and accepted');

  // Scenario 2: Equivalent Wording
  const equivClaimA: ExtractedClaim = { ...validClaim, id: 'eq1', assertion: 'retrieves profile', rawSnippet: 'retrieves profile' };
  const equivClaimB: ExtractedClaim = { ...validClaim, id: 'eq2', filePath: 'src/user.ts', sourceType: 'CODE', assertion: 'fetches user info', rawSnippet: 'fetches user info' };
  const mockArtifactsWithUser = [...mockArtifacts, { ...mockArtifacts[0], filePath: 'src/user.ts', content: 'fetches user info' }];

  const equivResult = await evaluateSemanticContradictions(
    mockArtifactsWithUser,
    [equivClaimA, equivClaimB],
    { client: mockLLM }
  );
  assert(equivResult.findings.length === 0, 'Equivalent wording does NOT trigger contradiction');

  console.log(`\n=======================================================`);
  console.log(` TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log(`=======================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllUnitTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
