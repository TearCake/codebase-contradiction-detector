export type ArtifactType = 'CODE' | 'DOCS' | 'SPEC' | 'CONFIG' | 'TEST';

export type LanguageFormat = 
  | 'typescript' 
  | 'javascript' 
  | 'markdown' 
  | 'yaml' 
  | 'json' 
  | 'env' 
  | 'unknown';

export type ContradictionCategory = 
  | 'STRUCTURAL' 
  | 'BEHAVIORAL' 
  | 'API_CONTRACT' 
  | 'CONFIGURATION' 
  | 'TESTING';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SourceLocation {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

export interface ExtractedSymbol {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type';
  isExported: boolean;
  location: SourceLocation;
  comment?: string;
}

export interface ExtractedImport {
  moduleSpecifier: string;
  importedSymbols: string[];
  location: SourceLocation;
}

export interface ExtractedRoute {
  method: string;             // GET, POST, PUT, DELETE, PATCH, etc.
  path: string;               // e.g. /api/v1/users
  handlerName?: string;
  location: SourceLocation;
  rawSnippet: string;
}

export interface ExtractedEnvRef {
  name: string;
  valueOrDefault?: string;
  location: SourceLocation;
  rawSnippet: string;
  isDefinition: boolean;      // true if in .env, false if process.env read in code
}

export interface ExtractedOpenApiEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: Array<{
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie' | string;
    required: boolean;
    schemaType?: string;
  }>;
  requestBodyRequired?: boolean;
  requestBodySchema?: Record<string, unknown>;
  requiredFields: string[];   // Required fields in requestBody schema
  responses: Array<{
    statusCode: string;
    description?: string;
  }>;
  location: SourceLocation;
  rawSnippet: string;
}

export interface ExtractedMarkdownSection {
  type: 'heading' | 'paragraph' | 'code_block';
  level?: number;             // Heading level 1-6
  text: string;
  language?: string;          // For code blocks e.g. 'json', 'typescript'
  location: SourceLocation;
  rawSnippet: string;
}

export interface ExtractedTestItem {
  title: string;
  kind: 'describe' | 'it' | 'test';
  assertions: Array<{
    type: string;
    target?: string;
    expected?: string;
    location: SourceLocation;
  }>;
  location: SourceLocation;
  rawSnippet: string;
}

export interface ExtractedClaim {
  id: string;
  artifactId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  sourceType: ArtifactType;
  rawSnippet: string;
  subject: string;
  assertion: string;
  symbolName?: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedArtifact {
  id: string;                      // e.g., "file:src/controllers/subscription.ts"
  filePath: string;                // Relative path
  absolutePath: string;
  artifactType: ArtifactType;
  format: LanguageFormat;
  content: string;
  lineCount: number;
  size: number;
  metadata: Record<string, unknown>;
  extracted: {
    symbols: ExtractedSymbol[];
    imports: ExtractedImport[];
    routes: ExtractedRoute[];
    envRefs: ExtractedEnvRef[];
    openApiEndpoints: ExtractedOpenApiEndpoint[];
    markdownSections: ExtractedMarkdownSection[];
    testItems: ExtractedTestItem[];
    claims: ExtractedClaim[];      // Backwards-compatible claim representation
  };
}

export interface RepositorySummary {
  totalFilesScanned: number;
  relevantArtifactsCount: number;
  ignoredFilesCount: number;
  filesByArtifactType: Record<ArtifactType, number>;
  filesByFormat: Record<LanguageFormat, number>;
  metrics: {
    totalRoutes: number;
    totalOpenApiEndpoints: number;
    totalEnvVariablesDeclared: number;
    totalEnvReferencesInCode: number;
    totalTestFiles: number;
    totalExportedSymbols: number;
  };
}

export interface ProbabilisticSourceOfTruth {
  filePath: string;
  probability: number;
  reasoning: string;
}

export interface ContradictionFinding {
  id: string;
  subject: string;
  category: ContradictionCategory;
  title: string;
  summary: string;
  conflictingClaims: ExtractedClaim[];
  incompatibilityReason: string;
  confidenceScore: number;
  severity: SeverityLevel;
  probabilisticSourceOfTruth: ProbabilisticSourceOfTruth;
  status: 'OPEN' | 'RESOLVED' | 'IGNORED';
}

export interface ContextGraphNode {
  id: string;
  type: 'ARTIFACT' | 'CLAIM' | 'SUBJECT';
  label: string;
  data: Record<string, unknown>;
}

export interface ContextGraphEdge {
  id: string;
  source: string;
  target: string;
  relation: 'CONTAINS' | 'ADDRESSES' | 'CONFLICTS_WITH';
}

export interface RepositoryContextGraph {
  nodes: ContextGraphNode[];
  edges: ContextGraphEdge[];
}

// Retained for legacy/backward compatibility
export interface IngestedFile {
  filePath: string;
  absolutePath: string;
  artifactType: ArtifactType;
  content: string;
  size: number;
}
