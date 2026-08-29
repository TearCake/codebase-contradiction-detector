import path from 'path';
import { ingestRepository } from '../engine/ingestion';
import { extractClaimsFromArtifact } from '../engine/extractor';
import { IngestedFile, ExtractedClaim } from '../types/engine';

const demoRepoPath = path.join(process.cwd(), 'demo-repo');

console.log('Testing Repository Ingestion...');
const files: IngestedFile[] = ingestRepository(demoRepoPath);
console.log(`Ingested ${files.length} files from demo repository:`);
files.forEach((f: IngestedFile) => console.log(` - [${f.artifactType}] ${f.filePath} (${f.size} bytes)`));

console.log('\nTesting Artifact Claim Extraction...');
let totalClaims = 0;
files.forEach((file: IngestedFile) => {
  const claims: ExtractedClaim[] = extractClaimsFromArtifact(file);
  totalClaims += claims.length;
  if (claims.length > 0) {
    console.log(`\nClaims extracted from ${file.filePath} (${claims.length}):`);
    claims.forEach((c: ExtractedClaim) => {
      console.log(`   * [${c.subject}] L${c.startLine}: ${c.assertion}`);
    });
  }
});

console.log(`\nTotal Extracted Claims: ${totalClaims}`);
