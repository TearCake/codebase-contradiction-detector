import { NormalizedArtifact, RepositorySummary, ArtifactType, LanguageFormat } from '../types/engine';
import { ScanResult } from './scanner';

export function produceRepositorySummary(scanResult: ScanResult): RepositorySummary {
  const { artifacts, scannedCount, ignoredCount } = scanResult;

  const filesByArtifactType: Record<ArtifactType, number> = {
    CODE: 0,
    DOCS: 0,
    SPEC: 0,
    CONFIG: 0,
    TEST: 0,
  };

  const filesByFormat: Record<LanguageFormat, number> = {
    typescript: 0,
    javascript: 0,
    markdown: 0,
    yaml: 0,
    json: 0,
    env: 0,
    unknown: 0,
  };

  let totalRoutes = 0;
  let totalOpenApiEndpoints = 0;
  let totalEnvVariablesDeclared = 0;
  let totalEnvReferencesInCode = 0;
  let totalTestFiles = 0;
  let totalExportedSymbols = 0;

  for (const artifact of artifacts) {
    filesByArtifactType[artifact.artifactType] = (filesByArtifactType[artifact.artifactType] || 0) + 1;
    filesByFormat[artifact.format] = (filesByFormat[artifact.format] || 0) + 1;

    totalRoutes += artifact.extracted.routes.length;
    totalOpenApiEndpoints += artifact.extracted.openApiEndpoints.length;

    for (const envRef of artifact.extracted.envRefs) {
      if (envRef.isDefinition) {
        totalEnvVariablesDeclared++;
      } else {
        totalEnvReferencesInCode++;
      }
    }

    if (artifact.artifactType === 'TEST') {
      totalTestFiles++;
    }

    totalExportedSymbols += artifact.extracted.symbols.filter(s => s.isExported).length;
  }

  return {
    totalFilesScanned: scannedCount,
    relevantArtifactsCount: artifacts.length,
    ignoredFilesCount: ignoredCount,
    filesByArtifactType,
    filesByFormat,
    metrics: {
      totalRoutes,
      totalOpenApiEndpoints,
      totalEnvVariablesDeclared,
      totalEnvReferencesInCode,
      totalTestFiles,
      totalExportedSymbols,
    },
  };
}
