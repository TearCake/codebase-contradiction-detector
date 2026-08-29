import fs from 'fs';
import path from 'path';
import { IngestedFile, ArtifactType } from '../types/engine';

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
]);

export function classifyArtifactType(filePath: string): ArtifactType | null {
  const normalized = filePath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();

  if (lower.includes('test') || lower.endsWith('.spec.ts') || lower.endsWith('.test.ts') || lower.endsWith('.test.js')) {
    return 'TEST';
  }
  if (lower.endsWith('.env') || lower.endsWith('.env.example') || lower.endsWith('.env.local') || lower.includes('config/')) {
    return 'CONFIG';
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.json') && lower.includes('spec')) {
    return 'SPEC';
  }
  if (lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.txt')) {
    return 'DOCS';
  }
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.jsx')) {
    return 'CODE';
  }

  return null;
}

export function ingestRepository(repoPath: string): IngestedFile[] {
  const results: IngestedFile[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(repoPath, fullPath).replace(/\\/g, '/');
        const artifactType = classifyArtifactType(relativePath);

        if (artifactType) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const stats = fs.statSync(fullPath);

            results.push({
              filePath: relativePath,
              absolutePath: fullPath,
              artifactType,
              content,
              size: stats.size,
            });
          } catch (err) {
            console.error(`Failed to read file ${fullPath}:`, err);
          }
        }
      }
    }
  }

  if (fs.existsSync(repoPath)) {
    walk(repoPath);
  }

  return results;
}
