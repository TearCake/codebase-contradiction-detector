import { NextRequest, NextResponse } from 'next/server';
import { discoverProviderModels } from '../../../engine/llm/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, apiKey, baseURL } = body;

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 });
    }

    const result = await discoverProviderModels(provider, apiKey, baseURL);
    
    // Do not return raw errors or provider metadata.
    // Ensure API key is never serialized back to the client.
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ status: 'PROVIDER_UNAVAILABLE' }, { status: 200 });
  }
}
