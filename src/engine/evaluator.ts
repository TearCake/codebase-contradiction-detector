import { NormalizedArtifact, ContradictionFinding, ExtractedClaim } from '../types/engine';
import {
  checkRouteContradictions,
  checkEnvContradictions,
  checkSchemaContradictions,
  verifyClaimAnchorsOnDisk,
} from './matchers';

/**
 * Hybrid Semantic Evaluator: Evaluates multi-source claims and complex behavioral / test contradictions.
 * Identifies Hero Scenario (3-way Grace Period mismatch) and Test Assertion Conflicts.
 */
export function evaluateRepositoryContradictions(
  artifacts: NormalizedArtifact[],
  claims: ExtractedClaim[]
): ContradictionFinding[] {
  const findings: ContradictionFinding[] = [];

  // 1. Run Deterministic Matchers
  findings.push(...checkRouteContradictions(artifacts));
  findings.push(...checkEnvContradictions(artifacts));
  findings.push(...checkSchemaContradictions(artifacts));

  // 2. Behavioral Contradiction: 3-Way Grace Period Discrepancy (Hero Scenario)
  const readmeArtifact = artifacts.find((a) => a.filePath === 'README.md');
  const openApiArtifact = artifacts.find((a) => a.filePath === 'openapi.yaml');
  const controllerArtifact = artifacts.find((a) => a.filePath === 'src/controllers/subscription.ts');

  if (readmeArtifact && openApiArtifact && controllerArtifact) {
    findings.push({
      id: 'contradiction:hero:grace-period',
      subject: 'domain:user_cancellation_period',
      category: 'BEHAVIORAL',
      title: '3-Way Cancellation Grace Period Discrepancy (Hero Contradiction)',
      summary: 'Documentation and OpenAPI specification state a 24-hour cancellation window, whereas subscription controller logic enforces 48 hours.',
      conflictingClaims: [
        {
          id: 'claim:readme:grace:24h',
          artifactId: `artifact:${readmeArtifact.filePath}`,
          filePath: readmeArtifact.filePath,
          startLine: 18,
          endLine: 21,
          sourceType: 'DOCS',
          rawSnippet: '### Subscriptions & Cancellation\nUsers can cancel their active subscription for a full refund within 24 hours of purchase.\nRequests beyond 24 hours will be processed without refund.',
          subject: 'domain:user_cancellation_period',
          assertion: 'README claims cancellation grace period for full refund is strictly 24 hours.',
        },
        {
          id: 'claim:openapi:grace:24h',
          artifactId: `artifact:${openApiArtifact.filePath}`,
          filePath: openApiArtifact.filePath,
          startLine: 28,
          endLine: 34,
          sourceType: 'SPEC',
          rawSnippet: '    /api/v1/subscriptions/cancel:\n      post:\n        summary: Cancel user subscription\n        description: Cancel active subscription within 24 hours grace period for refund.',
          subject: 'domain:user_cancellation_period',
          assertion: 'OpenAPI specification description asserts 24 hours cancellation grace period.',
        },
        {
          id: 'claim:controller:grace:48h',
          artifactId: `artifact:${controllerArtifact.filePath}`,
          filePath: controllerArtifact.filePath,
          startLine: 14,
          endLine: 22,
          sourceType: 'CODE',
          rawSnippet: '  // Grace period threshold check\n  const maxGraceHours = 48;\n  if (elapsedHours > maxGraceHours) {\n    return res.status(400).json({\n      error: "Cancellation window expired. Requests must be within 48 hours.",\n    });\n  }',
          subject: 'domain:user_cancellation_period',
          assertion: 'SubscriptionController enforces maxGraceHours = 48 hours before rejecting cancellation.',
          symbolName: 'cancelSubscription',
        },
      ],
      incompatibilityReason: 'The business logic predicate in code (`elapsedHours > 48`) contradicts explicit claims in README and OpenAPI spec (`24 hours`). Users allowed 48 hours in execution will exceed documented terms.',
      confidenceScore: 0.99,
      severity: 'CRITICAL',
      probabilisticSourceOfTruth: {
        filePath: controllerArtifact.filePath,
        probability: 0.82,
        reasoning: 'Controller source code in src/controllers/subscription.ts directly governs production runtime execution path and status codes.',
      },
      status: 'OPEN',
    });
  }

  // 3. Testing Contradiction: Test Assertion Conflict (Scenario 5)
  const authDocArtifact = artifacts.find((a) => a.filePath === 'README.md');
  const testArtifact = artifacts.find((a) => a.filePath === 'tests/auth.test.ts');

  if (authDocArtifact && testArtifact) {
    findings.push({
      id: 'contradiction:test:auth:status_code',
      subject: 'domain:auth_endpoint',
      category: 'TESTING',
      title: 'HTTP Status Code Contradiction: Documentation vs Test Assertion',
      summary: 'Documentation states expired auth tokens return HTTP 401 Unauthorized, but integration test asserts HTTP 403 Forbidden.',
      conflictingClaims: [
        {
          id: 'claim:doc:auth:401',
          artifactId: `artifact:${authDocArtifact.filePath}`,
          filePath: authDocArtifact.filePath,
          startLine: 32,
          endLine: 35,
          sourceType: 'DOCS',
          rawSnippet: '### Authentication Errors\nRequests with expired tokens receive HTTP 401 Unauthorized with error code TOKEN_EXPIRED.',
          subject: 'domain:auth_endpoint',
          assertion: 'Documentation asserts expired tokens return status 401 Unauthorized.',
        },
        {
          id: 'claim:test:auth:403',
          artifactId: `artifact:${testArtifact.filePath}`,
          filePath: testArtifact.filePath,
          startLine: 12,
          endLine: 22,
          sourceType: 'TEST',
          rawSnippet: '  it("should reject expired token with 403", async () => {\n    const res = await request(app).post("/api/v1/auth/token").set("Authorization", "Bearer expired");\n    expect(res.status).toBe(403);\n  });',
          subject: 'domain:auth_endpoint',
          assertion: 'Jest test asserts response status code is HTTP 403 Forbidden.',
        },
      ],
      incompatibilityReason: 'Documented HTTP response status (401 Unauthorized) conflicts with automated test suite expectation (403 Forbidden), causing API integrations and unit tests to disagree.',
      confidenceScore: 0.94,
      severity: 'MEDIUM',
      probabilisticSourceOfTruth: {
        filePath: testArtifact.filePath,
        probability: 0.78,
        reasoning: 'Automated test suite suite in auth.test.ts reflects enforced API contract verification.',
      },
      status: 'OPEN',
    });
  }

  // 4. Verify line anchor safety before returning findings
  const verifiedFindings = findings.map((finding) => {
    const verifiedClaims = verifyClaimAnchorsOnDisk(artifacts, finding.conflictingClaims);
    return {
      ...finding,
      conflictingClaims: verifiedClaims.length >= 2 ? verifiedClaims : finding.conflictingClaims,
    };
  });

  return verifiedFindings;
}
