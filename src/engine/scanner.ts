import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { ArtifactType, LanguageFormat, NormalizedArtifact } from '../types/engine';

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'vendor',
  '.cache',
]);

const TEST_FILE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/i,
  /\.spec\.(ts|tsx|js|jsx)$/i,
  /__tests__\//i,
];

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return TEST_FILE_PATTERNS.some(pattern => pattern.test(normalized));
}

export function isOpenApiDocument(content: string, filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  if (!normalized.endsWith('.yaml') && !normalized.endsWith('.yml') && !normalized.endsWith('.json')) {
    return false;
  }

  try {
    let doc: Record<string, unknown> | null = null;
    if (normalized.endsWith('.json')) {
      doc = JSON.parse(content);
    } else {
      doc = yaml.parse(content);
    }

    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      if ('openapi' in doc || 'swagger' in doc || ('paths' in doc && typeof doc.paths === 'object')) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export function classifyFile(filePath: string, content: string): { artifactType: ArtifactType; format: LanguageFormat } | null {
  const normalized = filePath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const basename = path.basename(lower);

  if (isTestFile(normalized)) {
    const format: LanguageFormat = lower.endsWith('.tsx') || lower.endsWith('.jsx')
      ? 'typescript'
      : (lower.endsWith('.ts') ? 'typescript' : 'javascript');
    return { artifactType: 'TEST', format };
  }

  if (basename === '.env' || basename === '.env.example' || basename.startsWith('.env.')) {
    return { artifactType: 'CONFIG', format: 'env' };
  }

  if (lower.endsWith('.md') || lower.endsWith('.mdx')) {
    return { artifactType: 'DOCS', format: 'markdown' };
  }

  if (lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.json')) {
    if (isOpenApiDocument(content, normalized)) {
      return { artifactType: 'SPEC', format: lower.endsWith('.json') ? 'json' : 'yaml' };
    }
    // Non-OpenAPI config JSON/YAML
    return { artifactType: 'CONFIG', format: lower.endsWith('.json') ? 'json' : 'yaml' };
  }

  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
    return { artifactType: 'CODE', format: 'typescript' };
  }

  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return { artifactType: 'CODE', format: 'javascript' };
  }

  return null;
}

export interface ScanResult {
  artifacts: NormalizedArtifact[];
  scannedCount: number;
  ignoredCount: number;
}

export function scanRepository(repoPath: string): ScanResult {
  const resolvedRepoPath = path.resolve(repoPath);
  const artifacts: NormalizedArtifact[] = [];
  let scannedCount = 0;
  let ignoredCount = 0;

  function walk(currentDir: string) {
    // Safety check: ensure currentDir never traverses outside resolvedRepoPath
    const relativeToRoot = path.relative(resolvedRepoPath, currentDir);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot) && relativeToRoot.includes('..')) {
      return;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      // Safely skip unreadable directories
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        ignoredCount++;
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      
      // Secondary safety check for file/dir path
      if (!fullPath.startsWith(resolvedRepoPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        scannedCount++;
        const relativePath = path.relative(resolvedRepoPath, fullPath).replace(/\\/g, '/');

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const classification = classifyFile(relativePath, content);

          if (classification) {
            const lines = content.split('\n');
            const stats = fs.statSync(fullPath);

            artifacts.push({
              id: `artifact:${relativePath}`,
              filePath: relativePath,
              absolutePath: fullPath,
              artifactType: classification.artifactType,
              format: classification.format,
              content,
              lineCount: lines.length,
              size: stats.size,
              metadata: {
                isTest: classification.artifactType === 'TEST',
              },
              extracted: {
                symbols: [],
                imports: [],
                routes: [],
                envRefs: [],
                openApiEndpoints: [],
                markdownSections: [],
                testItems: [],
                claims: [],
              },
            });
          }
        } catch {
          // Unreadable or binary files are skipped safely
          ignoredCount++;
        }
      }
    }
  }

  if (fs.existsSync(resolvedRepoPath)) {
    walk(resolvedRepoPath);
  }

  return { artifacts, scannedCount, ignoredCount };
}
