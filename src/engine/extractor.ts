import { NormalizedArtifact } from '../types/engine';
import { extractCodeArtifacts } from './extractors/codeExtractor';
import { extractOpenApiArtifacts } from './extractors/openApiExtractor';
import { extractEnvArtifacts } from './extractors/envExtractor';
import { extractMarkdownArtifacts } from './extractors/markdownExtractor';
import { extractTestArtifacts } from './extractors/testExtractor';

export function extractArtifactInformation(artifact: NormalizedArtifact): void {
  switch (artifact.artifactType) {
    case 'CODE':
      extractCodeArtifacts(artifact);
      break;
    case 'SPEC':
      extractOpenApiArtifacts(artifact);
      break;
    case 'CONFIG':
      if (artifact.format === 'env') {
        extractEnvArtifacts(artifact);
      } else {
        extractCodeArtifacts(artifact);
      }
      break;
    case 'DOCS':
      extractMarkdownArtifacts(artifact);
      break;
    case 'TEST':
      extractTestArtifacts(artifact);
      extractCodeArtifacts(artifact);
      break;
    default:
      break;
  }
}
