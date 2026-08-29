import { NextResponse } from 'next/server';
import { runFullAnalysisPipelineAsync } from '../../../engine/index';
import path from 'path';

export async function GET() {
  try {
    const repoPath = path.resolve(process.cwd(), 'demo-repo');
    const result = await runFullAnalysisPipelineAsync(repoPath);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis failed:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
