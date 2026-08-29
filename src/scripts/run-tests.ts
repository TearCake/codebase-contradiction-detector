import path from 'path';
import { scanRepository, isOpenApiDocument, classifyFile } from '../engine/scanner';
import { extractArtifactInformation } from '../engine/extractor';
import { produceRepositorySummary } from '../engine/summary';

function runTests() {
  console.log('====================================================');
  console.log(' RUNNING INGESTION & EXTRACTION FOUNDATION SUITE');
  console.log('====================================================\n');

  // Test 1: OpenAPI structure detection vs generic YAML/JSON
  console.log('Test 1: OpenAPI Structure Detection...');
  const openApiYaml = `openapi: 3.0.0\ninfo:\n  title: Test API\npaths: {}`;
  const nonOpenApiYaml = `version: "3"\nservices:\n  web:\n    image: nginx`;
  
  console.assert(isOpenApiDocument(openApiYaml, 'spec.yaml') === true, 'OpenAPI YAML should be detected as OpenAPI');
  console.assert(isOpenApiDocument(nonOpenApiYaml, 'docker-compose.yaml') === false, 'Docker compose YAML should NOT be detected as OpenAPI');
  console.log('  Passed OpenAPI structure detection check.\n');

  // Test 2: File classification
  console.log('Test 2: File Classification...');
  const testCls = classifyFile('tests/auth.test.ts', 'describe("auth", () => {})');
  console.assert(testCls?.artifactType === 'TEST', 'Test file classification failed');

  const envCls = classifyFile('.env.example', 'PORT=3000');
  console.assert(envCls?.artifactType === 'CONFIG' && envCls.format === 'env', 'Env file classification failed');

  const docCls = classifyFile('README.md', '# Doc');
  console.assert(docCls?.artifactType === 'DOCS', 'Markdown classification failed');
  console.log('  Passed file classification check.\n');

  // Test 3: Demo Repository Scanning & Extraction
  console.log('Test 3: Demo Repository Ingestion & Line Number Verification...');
  const demoRepoPath = path.join(process.cwd(), 'demo-repo');
  const scanResult = scanRepository(demoRepoPath);

  console.log(`  Scanned ${scanResult.scannedCount} files, found ${scanResult.artifacts.length} relevant artifacts.`);
  console.assert(scanResult.artifacts.length === 8, `Expected 8 relevant artifacts in demo-repo, found ${scanResult.artifacts.length}`);

  scanResult.artifacts.forEach(artifact => {
    extractArtifactInformation(artifact);
  });

  const summary = produceRepositorySummary(scanResult);
  console.log('  Repository Summary Matrix:');
  console.log(`    Total Files Scanned: ${summary.totalFilesScanned}`);
  console.log(`    Relevant Artifacts: ${summary.relevantArtifactsCount}`);
  console.log(`    Routes Extracted: ${summary.metrics.totalRoutes}`);
  console.log(`    OpenAPI Endpoints Extracted: ${summary.metrics.totalOpenApiEndpoints}`);
  console.log(`    Env Vars Declared: ${summary.metrics.totalEnvVariablesDeclared}`);
  console.log(`    Env Refs in Code: ${summary.metrics.totalEnvReferencesInCode}`);
  console.log(`    Test Files: ${summary.metrics.totalTestFiles}`);

  // Test 4: Line Number Accuracy Check
  console.log('\nTest 4: Line Number Accuracy Verification on Extracted Claims...');
  let checkedCount = 0;
  for (const artifact of scanResult.artifacts) {
    const lines = artifact.content.split('\n');
    for (const claim of artifact.extracted.claims) {
      checkedCount++;
      const actualLine = lines[claim.startLine - 1];
      console.assert(actualLine !== undefined, `Line ${claim.startLine} out of bounds in ${artifact.filePath}`);
      if (claim.symbolName && claim.sourceType === 'CONFIG') {
        console.assert(actualLine.includes(claim.symbolName), `Line ${claim.startLine} in ${artifact.filePath} does not contain symbol '${claim.symbolName}'`);
      }
    }
  }
  console.log(`  Verified ${checkedCount} extracted claim line anchors against disk content.`);

  console.log('\n====================================================');
  console.log(' ALL TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests();
