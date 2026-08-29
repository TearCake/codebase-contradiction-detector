import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  canonicalUrl: string;
}

export interface DownloadResult {
  tempDir: string;
  owner: string;
  repo: string;
  canonicalUrl: string;
  extractedFileCount: number;
}

export interface SafetyLimits {
  maxDownloadBytes: number; // Default 25 MB
  maxExtractedBytes: number; // Default 50 MB
  maxFileCount: number; // Default 1000 files
}

export const DEFAULT_SAFETY_LIMITS: SafetyLimits = {
  maxDownloadBytes: 25 * 1024 * 1024,
  maxExtractedBytes: 50 * 1024 * 1024,
  maxFileCount: 1000,
};

export function parseGitHubUrl(urlInput: string): ParsedGitHubUrl {
  if (!urlInput || typeof urlInput !== 'string') {
    throw new Error('Please enter a valid GitHub repository URL.');
  }

  const trimmed = urlInput.trim();
  if (!trimmed) {
    throw new Error('Please enter a valid GitHub repository URL.');
  }

  let parsed: URL;
  try {
    // Add protocol if missing
    const withProtocol = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Invalid GitHub repository URL format.');
  }

  // Validate hostname is github.com
  if (parsed.hostname.toLowerCase() !== 'github.com' && parsed.hostname.toLowerCase() !== 'www.github.com') {
    throw new Error('Only public github.com repositories are supported.');
  }

  // Path format: /owner/repo or /owner/repo.git or /owner/repo/
  const pathSegments = parsed.pathname.split('/').filter((s) => s.length > 0);
  if (pathSegments.length < 2) {
    throw new Error('GitHub URL must include both owner and repository name (e.g. https://github.com/owner/repository).');
  }

  const owner = pathSegments[0];
  let repo = pathSegments[1];

  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  // Sanitize owner and repo against injection and invalid chars
  const validNameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!validNameRegex.test(owner) || !validNameRegex.test(repo) || owner.includes('..') || repo.includes('..')) {
    throw new Error('Invalid GitHub repository owner or name.');
  }

  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}

export function extractZipBufferToDir(
  zipBuffer: Buffer,
  targetDir: string,
  limits: SafetyLimits = DEFAULT_SAFETY_LIMITS
): number {
  if (zipBuffer.length > limits.maxDownloadBytes) {
    throw new Error(`Repository download size exceeds limit of ${Math.round(limits.maxDownloadBytes / (1024 * 1024))}MB.`);
  }

  // Locate End of Central Directory Record (EOCD signature: 0x06054b50)
  let eocdOffset = zipBuffer.length - 22;
  while (eocdOffset >= 0) {
    if (zipBuffer.readUInt32LE(eocdOffset) === 0x06054b50) {
      break;
    }
    eocdOffset--;
  }

  if (eocdOffset < 0) {
    throw new Error('Failed to parse downloaded repository archive (invalid ZIP format).');
  }

  const cdRecordsCount = zipBuffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  if (cdRecordsCount > limits.maxFileCount) {
    throw new Error(`Repository exceeds maximum file count limit of ${limits.maxFileCount} files.`);
  }

  let currentOffset = cdOffset;
  let totalExtractedBytes = 0;
  let extractedFileCount = 0;

  // Determine root directory prefix if present in GitHub zipball (e.g., owner-repo-commit/)
  let commonPrefix = '';
  if (cdRecordsCount > 0 && zipBuffer.readUInt32LE(currentOffset) === 0x02014b50) {
    const nameLen = zipBuffer.readUInt16LE(currentOffset + 28);
    const firstName = zipBuffer.toString('utf8', currentOffset + 46, currentOffset + 46 + nameLen);
    const slashIdx = firstName.indexOf('/');
    if (slashIdx !== -1) {
      commonPrefix = firstName.substring(0, slashIdx + 1);
    }
  }

  const normalizedTargetDir = path.resolve(targetDir);

  for (let i = 0; i < cdRecordsCount; i++) {
    if (currentOffset + 46 > zipBuffer.length || zipBuffer.readUInt32LE(currentOffset) !== 0x02014b50) {
      break;
    }

    const method = zipBuffer.readUInt16LE(currentOffset + 10);
    const compSize = zipBuffer.readUInt32LE(currentOffset + 20);
    const uncompSize = zipBuffer.readUInt32LE(currentOffset + 24);
    const nameLen = zipBuffer.readUInt16LE(currentOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(currentOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(currentOffset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(currentOffset + 42);

    let fileName = zipBuffer.toString('utf8', currentOffset + 46, currentOffset + 46 + nameLen);

    // Strip top-level directory prefix if applicable
    if (commonPrefix && fileName.startsWith(commonPrefix)) {
      fileName = fileName.substring(commonPrefix.length);
    }

    currentOffset += 46 + nameLen + extraLen + commentLen;

    if (!fileName || fileName.endsWith('/')) {
      continue;
    }

    // Zip Slip / Path Traversal Prevention
    const destPath = path.resolve(normalizedTargetDir, fileName);
    if (!destPath.startsWith(normalizedTargetDir + path.sep) && destPath !== normalizedTargetDir) {
      throw new Error(`Security error: Malicious path detected in archive: ${fileName}`);
    }

    totalExtractedBytes += uncompSize;
    if (totalExtractedBytes > limits.maxExtractedBytes) {
      throw new Error(`Repository extracted size exceeds limit of ${Math.round(limits.maxExtractedBytes / (1024 * 1024))}MB.`);
    }

    // Read data offset from Local File Header
    const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + nameLen + localExtraLen;

    if (dataOffset + compSize > zipBuffer.length) {
      throw new Error('Corrupted repository ZIP archive.');
    }

    const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compSize);
    let decompressed: Buffer;

    try {
      if (method === 0) {
        decompressed = compressedData;
      } else if (method === 8) {
        decompressed = zlib.inflateRawSync(compressedData);
      } else {
        throw new Error(`Unsupported compression method: ${method}`);
      }
    } catch (err: any) {
      throw new Error(`Failed to decompress file ${fileName}: ${err?.message || err}`);
    }

    // Ensure directory exists
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(destPath, decompressed);
    extractedFileCount++;

    if (extractedFileCount > limits.maxFileCount) {
      throw new Error(`Repository exceeds maximum file count limit of ${limits.maxFileCount} files.`);
    }
  }

  return extractedFileCount;
}

export async function downloadGitHubRepository(
  urlInput: string,
  limits: SafetyLimits = DEFAULT_SAFETY_LIMITS
): Promise<DownloadResult> {
  const { owner, repo, canonicalUrl } = parseGitHubUrl(urlInput);

  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;

  let response: Response;
  try {
    response = await fetch(zipUrl, {
      headers: {
        'User-Agent': 'CodebaseContradictionDetector/1.0',
        Accept: 'application/vnd.github+json',
      },
      redirect: 'follow',
    });
  } catch (err: any) {
    throw new Error(`Network error while downloading repository: ${err?.message || err}`);
  }

  if (response.status === 404) {
    throw new Error(`Repository "${owner}/${repo}" was not found or is private. Only public repositories are supported.`);
  }

  if (response.status === 403 || response.status === 429) {
    throw new Error('GitHub API rate limit exceeded or access forbidden. Please try again later.');
  }

  if (!response.ok) {
    throw new Error(`GitHub download failed with status ${response.status}: ${response.statusText}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > limits.maxDownloadBytes) {
      throw new Error(`Repository download size exceeds limit of ${Math.round(limits.maxDownloadBytes / (1024 * 1024))}MB.`);
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuffer);

  if (zipBuffer.length > limits.maxDownloadBytes) {
    throw new Error(`Repository download size exceeds limit of ${Math.round(limits.maxDownloadBytes / (1024 * 1024))}MB.`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-repo-'));

  try {
    const extractedFileCount = extractZipBufferToDir(zipBuffer, tempDir, limits);
    return {
      tempDir,
      owner,
      repo,
      canonicalUrl,
      extractedFileCount,
    };
  } catch (err) {
    cleanupTempDir(tempDir);
    throw err;
  }
}

export function cleanupTempDir(dirPath: string): void {
  if (dirPath && fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (err) {
      console.error(`Failed to cleanup temp dir ${dirPath}:`, err);
    }
  }
}
