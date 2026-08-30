import path from 'path';
import { parseAndValidateLLMResponse, LLMClient } from '../engine/llm/client';
import { generateCandidatePairs, tokenizeText, computeJaccardSimilarity } from '../engine/llm/candidateMatcher';
import { verifyClaimEvidence, verifyPairEvidence } from '../engine/llm/evidenceVerifier';
import { evaluateSemanticContradictions } from '../engine/llm/semanticService';
import { evaluateRepositoryContradictionsAsync } from '../engine/evaluator';
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
  console.log(` RUNNING GROQ-INTEGRATED UNIT & INTEGRATION TEST SUITE`);
  console.log(`=======================================================\n`);

  // SECTION 1: LLM Response Parsing & Validation
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

  // SECTION 4: Provider & Fault-Tolerance Tests (Mocked Groq)
  console.log(`[4. Provider Fault Tolerance & Mocked Groq Tests]`);

  // Test 1: Missing API Key client
  const noKeyClient = new LLMClient({ apiKey: '' });
  assert(noKeyClient.isAvailable() === false, 'Missing API key client correctly reports unavailable');

  // Test 2: Mock Client for successful semantic comparison
  class SuccessfulGroqMockClient {
    public isAvailable() { return true; }
    public async compareClaims(req: any) {
      return {
        sameSubject: true,
        contradictory: true,
        confidence: 0.96,
        category: 'BEHAVIORAL' as const,
        title: 'Grace Period Discrepancy',
        summary: 'Documentation states 24 hours while code enforces 48 hours.',
        incompatibilityReason: 'Mutual exclusion between 24 and 48 hour predicates.',
        suggestedAuthoritativeSource: 'CLAIM_B' as const,
      };
    }
  }

  const successClient = new SuccessfulGroqMockClient() as any;
  const semanticRes = await evaluateSemanticContradictions(mockArtifacts, [claims[0], claims[1]], { client: successClient });
  assert(semanticRes.findings.length === 1 && semanticRes.acceptedAfterVerification === 1, 'Valid contradiction proposed by Groq is verified and accepted');

  // Test 3: Evidence Verification Failure
  const unverifiedClaim: ExtractedClaim = {
    ...claims[1],
    startLine: 99,
    endLine: 100, // Bad lines not in file
  };
  const unverifiedRes = await evaluateSemanticContradictions(mockArtifacts, [claims[0], unverifiedClaim], { client: successClient });
  assert(unverifiedRes.findings.length === 0, 'Semantic contradiction rejected if evidence verification fails');

  // Test 4: Timeout & 429 Error Fallback Client
  class RateLimitedGroqMockClient {
    private hits = 0;
    public isAvailable() { return this.hits === 0; }
    public async compareClaims(req: any) {
      this.hits++;
      return null; // Simulates HTTP 429 or Timeout
    }
  }

  const rateLimitClient = new RateLimitedGroqMockClient() as any;
  const rateLimitRes = await evaluateSemanticContradictions(mockArtifacts, [claims[0], claims[1]], { client: rateLimitClient });
  assert(rateLimitRes.findings.length === 0, 'HTTP 429 or Timeout yields null and gracefully degrades');

  // Test 5: Deterministic Fallback Pipeline Execution
  const pipelineFindings = await evaluateRepositoryContradictionsAsync(mockArtifacts, claims);
  assert(pipelineFindings.length >= 1, 'Deterministic matchers and fallbacks return findings when LLM is unavailable');

  // SECTION 5: GitHub Downloader, URL Parsing, Safety Limits & Cleanup
  console.log(`[5. GitHub Downloader & URL Parsing Tests]`);

  const { parseGitHubUrl, cleanupTempDir, extractZipBufferToDir } = require('../engine/githubDownloader');
  const fs = require('fs');
  const os = require('os');

  // Test 5.1: Valid URL Parsing
  const validUrl1 = parseGitHubUrl('https://github.com/facebook/react');
  assert(validUrl1.owner === 'facebook' && validUrl1.repo === 'react' && validUrl1.canonicalUrl === 'https://github.com/facebook/react', 'Standard https github URL parsed');

  const validUrl2 = parseGitHubUrl('github.com/vercel/next.js/');
  assert(validUrl2.owner === 'vercel' && validUrl2.repo === 'next.js' && validUrl2.canonicalUrl === 'https://github.com/vercel/next.js', 'Domain-only URL with trailing slash parsed');

  const validUrl3 = parseGitHubUrl('https://github.com/octocat/Hello-World.git');
  assert(validUrl3.owner === 'octocat' && validUrl3.repo === 'Hello-World', '.git suffix stripped');

  // Test 5.2: Invalid URL Rejection
  let rejectedGitlab = false;
  try {
    parseGitHubUrl('https://gitlab.com/owner/repo');
  } catch {
    rejectedGitlab = true;
  }
  assert(rejectedGitlab, 'Non-GitHub URL rejected');

  let rejectedMalformed = false;
  try {
    parseGitHubUrl('not-a-url');
  } catch {
    rejectedMalformed = true;
  }
  assert(rejectedMalformed, 'Malformed string rejected');

  let rejectedPathTraversal = false;
  try {
    parseGitHubUrl('https://github.com/../repo');
  } catch {
    rejectedPathTraversal = true;
  }
  assert(rejectedPathTraversal, 'Path traversal in URL rejected');

  // Test 5.3: Temp Directory Creation and Cleanup
  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-test-cleanup-'));
  const testFilePath = path.join(testTempDir, 'sample.txt');
  fs.writeFileSync(testFilePath, 'temp content');
  assert(fs.existsSync(testTempDir) && fs.existsSync(testFilePath), 'Temp directory created for testing');

  cleanupTempDir(testTempDir);
  assert(!fs.existsSync(testTempDir), 'cleanupTempDir completely removes temp directory');

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
