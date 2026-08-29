import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { runFullAnalysisPipelineAsync } from '../../../engine/index';
import { downloadGitHubRepository, cleanupTempDir, parseGitHubUrl } from '../../../engine/githubDownloader';
import { AnalysisPipelineResult } from '../../../types/engine';

function sanitizeResultPaths(result: AnalysisPipelineResult): AnalysisPipelineResult {
  // Strip absolute temporary filesystem paths before sending to browser
  if (result.artifacts) {
    result.artifacts = result.artifacts.map((art) => ({
      ...art,
      absolutePath: art.filePath,
    }));
  }
  if (result.scanResult?.artifacts) {
    result.scanResult.artifacts = result.scanResult.artifacts.map((art: any) => ({
      ...art,
      absolutePath: art.filePath,
    }));
  }
  return result;
}

export async function GET() {
  try {
    const repoPath = path.resolve(process.cwd(), 'demo-repo');
    const result = await runFullAnalysisPipelineAsync(repoPath);

    result.repositoryInfo = {
      source: 'demo',
      url: 'demo-repo',
      owner: 'demo',
      repo: 'demo-repo',
      fileCount: result.summary.totalFilesScanned,
      artifactCount: result.summary.relevantArtifactsCount,
    };

    return NextResponse.json(sanitizeResultPaths(result));
  } catch (error: any) {
    console.error('Demo analysis failed:', error);
    return NextResponse.json({ error: error?.message || 'Analysis failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const source = body.source || 'demo';

  if (source === 'demo') {
    try {
      const repoPath = path.resolve(process.cwd(), 'demo-repo');
      const result = await runFullAnalysisPipelineAsync(repoPath);

      result.repositoryInfo = {
        source: 'demo',
        url: 'demo-repo',
        owner: 'demo',
        repo: 'demo-repo',
        fileCount: result.summary.totalFilesScanned,
        artifactCount: result.summary.relevantArtifactsCount,
      };

      return NextResponse.json(sanitizeResultPaths(result));
    } catch (error: any) {
      console.error('Demo analysis failed:', error);
      return NextResponse.json({ error: error?.message || 'Analysis failed' }, { status: 500 });
    }
  }

  if (source === 'github') {
    const url = body.url;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'GitHub repository URL is required.' }, { status: 400 });
    }

    // Validate URL syntax
    try {
      parseGitHubUrl(url);
    } catch (valErr: any) {
      return NextResponse.json({ error: valErr?.message || 'Invalid GitHub repository URL.' }, { status: 400 });
    }

    let downloadRes;
    try {
      downloadRes = await downloadGitHubRepository(url);
    } catch (dlErr: any) {
      return NextResponse.json({ error: dlErr?.message || 'Failed to download GitHub repository.' }, { status: 400 });
    }

    const { tempDir, owner, repo, canonicalUrl, extractedFileCount } = downloadRes;

    try {
      const result = await runFullAnalysisPipelineAsync(tempDir);

      result.repositoryInfo = {
        source: 'github',
        url: canonicalUrl,
        owner,
        repo,
        fileCount: extractedFileCount || result.summary.totalFilesScanned,
        artifactCount: result.summary.relevantArtifactsCount,
      };

      return NextResponse.json(sanitizeResultPaths(result));
    } catch (analysisErr: any) {
      console.error('GitHub analysis failed:', analysisErr);
      return NextResponse.json({ error: `Analysis failed: ${analysisErr?.message || analysisErr}` }, { status: 500 });
    } finally {
      // Ensure temp repository directory is always cleaned up after scan
      cleanupTempDir(tempDir);
    }
  }

  return NextResponse.json({ error: `Unsupported source "${source}". Allowed sources: "demo", "github"` }, { status: 400 });
}
