import { NextResponse } from 'next/server';
import { runFullAnalysisPipeline } from '../../../engine/index';
import path from 'path';

export async function GET() {
  try {
    const repoPath = path.resolve(process.cwd(), 'demo-repo');
    const result = runFullAnalysisPipeline(repoPath);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis failed:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
