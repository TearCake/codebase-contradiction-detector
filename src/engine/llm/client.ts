import dotenv from 'dotenv';
dotenv.config();

export interface LLMComparisonRequest {
  claimA: {
    sourceType: string;
    filePath: string;
    subject: string;
    assertion: string;
    rawSnippet: string;
  };
  claimB: {
    sourceType: string;
    filePath: string;
    subject: string;
    assertion: string;
    rawSnippet: string;
  };
}

export interface LLMComparisonResponse {
  sameSubject: boolean;
  contradictory: boolean;
  confidence: number;
  category?: 'STRUCTURAL' | 'BEHAVIORAL' | 'API_CONTRACT' | 'CONFIGURATION' | 'TESTING';
  title?: string;
  summary?: string;
  incompatibilityReason?: string;
  suggestedAuthoritativeSource?: 'CLAIM_A' | 'CLAIM_B' | 'UNKNOWN';
}

export interface LLMProviderConfig {
  provider?: 'groq' | 'openai' | 'gemini';
  apiKey?: string;
  model?: string;
  baseURL?: string;
  deterministicOnly?: boolean;
}

export class LLMClient {
  private provider: 'groq' | 'openai' | 'gemini';
  private apiKey: string | undefined;
  private model: string;
  private baseURL: string;
  private isDeterministicOnly: boolean;
  private hasHitRateLimit = false;
  private lastError: { type: string, message: string } | null = null;

  constructor(config?: LLMProviderConfig) {
    this.isDeterministicOnly = Boolean(config?.deterministicOnly);
    
    if (this.isDeterministicOnly) {
      this.provider = 'groq';
      this.model = 'deterministic';
      this.baseURL = '';
      this.apiKey = undefined;
      return;
    }

    const rawProvider = (config?.provider || process.env.LLM_PROVIDER || '').toLowerCase();
    
    if (rawProvider === 'gemini' || process.env.GEMINI_API_KEY) {
      this.provider = 'gemini';
      this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
      this.model = config?.model || process.env.LLM_MODEL || 'gemini-2.5-flash';
      this.baseURL = config?.baseURL || process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
    } else if (rawProvider === 'openai') {
      this.provider = 'openai';
      this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
      this.model = config?.model || process.env.LLM_MODEL || 'gpt-4o-mini';
      this.baseURL = config?.baseURL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    } else {
      // Primary default provider: Groq
      this.provider = 'groq';
      this.apiKey = config?.apiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
      this.model = config?.model || process.env.LLM_MODEL || 'openai/gpt-oss-120b';
      this.baseURL = config?.baseURL || process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1';
    }
  }

  public isAvailable(): boolean {
    if (this.isDeterministicOnly) return false;
    if (this.lastError?.type === 'INVALID_MODEL' || this.lastError?.type === 'INVALID_API_KEY') return false;
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.hasHitRateLimit);
  }

  public getLastError(): { type: string, message: string } | null {
    if (this.isDeterministicOnly) {
      return { type: 'NOT_CONFIGURED', message: 'User explicitly selected Deterministic Analysis.' };
    }
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      return { type: 'NOT_CONFIGURED', message: 'No API key configured.' };
    }
    if (this.hasHitRateLimit) {
      return { type: 'RATE_LIMITED', message: 'Provider rate limit reached.' };
    }
    return this.lastError;
  }

  public getProviderName(): string {
    return this.provider;
  }

  public getModelName(): string {
    return this.model;
  }

  public async compareClaims(req: LLMComparisonRequest): Promise<LLMComparisonResponse | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const { systemPrompt, userPrompt } = this.buildPrompt(req);

    try {
      if (this.provider === 'gemini') {
        return await this.callGeminiFormat(`${systemPrompt}\n\n${userPrompt}`);
      } else {
        // Both Groq and OpenAI use OpenAI-compatible chat completions API
        return await this.callOpenAICompatibleFormat(systemPrompt, userPrompt);
      }
    } catch (error) {
      console.warn(`[LLMClient:${this.provider}] Request failed:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  private buildPrompt(req: LLMComparisonRequest): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are a precise software engineering semantic judge analyzing two extracted claims from a repository for potential contradictions.

INSTRUCTIONS:
1. Determine if Claim A and Claim B address the exact same software entity/subject or business logic rule ("sameSubject").
2. Determine if they make mutually exclusive assertions ("contradictory").
   - A contradiction means both claims cannot simultaneously be true in the system runtime or documentation (e.g., refund window 24h vs 48h, status 401 vs 403, required vs optional).
   - Harmless wording differences or non-overlapping scope are NOT contradictions.
   - Missing information is NOT a contradiction unless one explicitly requires what another forbids or omits in an incompatible contract.
3. Assign a confidence score between 0.0 and 1.0.
4. If contradictory, specify the category ('STRUCTURAL' | 'BEHAVIORAL' | 'API_CONTRACT' | 'CONFIGURATION' | 'TESTING').
5. Provide a short, clear title, summary, and detailed incompatibilityReason explaining why they conflict.
6. Which source is likely authoritative ('CLAIM_A' or 'CLAIM_B')? Usually actual runtime code or enforced test code > documentation/specs.

Return ONLY a valid, raw JSON object matching this schema without markdown code blocks:
{
  "sameSubject": boolean,
  "contradictory": boolean,
  "confidence": number,
  "category": "BEHAVIORAL" | "STRUCTURAL" | "API_CONTRACT" | "CONFIGURATION" | "TESTING",
  "title": "Short title",
  "summary": "One sentence narrative summary",
  "incompatibilityReason": "Clear technical reason explaining the mutual exclusion",
  "suggestedAuthoritativeSource": "CLAIM_A" | "CLAIM_B" | "UNKNOWN"
}`;

    const userPrompt = `CLAIM A:
- Source Type: ${req.claimA.sourceType}
- File Path: ${req.claimA.filePath}
- Subject: ${req.claimA.subject}
- Assertion: ${req.claimA.assertion}
- Raw Snippet:
\`\`\`
${req.claimA.rawSnippet}
\`\`\`

CLAIM B:
- Source Type: ${req.claimB.sourceType}
- File Path: ${req.claimB.filePath}
- Subject: ${req.claimB.subject}
- Assertion: ${req.claimB.assertion}
- Raw Snippet:
\`\`\`
${req.claimB.rawSnippet}
\`\`\``;

    return { systemPrompt, userPrompt };
  }

  private async callOpenAICompatibleFormat(systemPrompt: string, userPrompt: string): Promise<LLMComparisonResponse | null> {
    const url = `${this.baseURL}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.status === 429) {
        console.warn(`[LLMClient:${this.provider}] HTTP 429 Rate limit encountered. Bypassing remaining LLM calls for this scan.`);
        this.hasHitRateLimit = true;
        return null;
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn(`[LLMClient:${this.provider}] HTTP ${response.status} Invalid API key.`);
          this.lastError = { type: 'INVALID_API_KEY', message: 'API key was rejected by the provider.' };
          this.apiKey = undefined;
          return null;
        }
        if (response.status === 404) {
          console.warn(`[LLMClient:${this.provider}] HTTP 404 Invalid model.`);
          this.lastError = { type: 'INVALID_MODEL', message: 'The selected model is invalid or unavailable.' };
          this.apiKey = undefined;
          return null;
        }

        const errText = await response.text();
        console.warn(`[LLMClient:${this.provider}] API HTTP ${response.status}: ${errText.slice(0, 200)}`);
        this.lastError = { type: 'PROVIDER_UNAVAILABLE', message: 'The provider returned an error.' };
        return null;
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content;
      const parsed = parseAndValidateLLMResponse(rawText);
      if (!parsed) {
        this.lastError = { type: 'MALFORMED_RESPONSE', message: 'The provider returned an unusable response.' };
      }
      return parsed;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.warn(`[LLMClient:${this.provider}] Request timed out after 15s.`);
        this.lastError = { type: 'TIMEOUT', message: 'The provider request timed out.' };
      } else {
        console.warn(`[LLMClient:${this.provider}] Request error:`, err instanceof Error ? err.message : err);
        this.lastError = { type: 'PROVIDER_UNAVAILABLE', message: 'The provider could not be reached.' };
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callGeminiFormat(prompt: string): Promise<LLMComparisonResponse | null> {
    const url = `${this.baseURL}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (response.status === 429) {
        console.warn(`[LLMClient:gemini] HTTP 429 Rate limit encountered. Bypassing remaining LLM calls for this scan.`);
        this.hasHitRateLimit = true;
        return null;
      }

      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          console.warn(`[LLMClient:gemini] HTTP ${response.status} Invalid API key.`);
          this.lastError = { type: 'INVALID_API_KEY', message: 'API key was rejected by the provider.' };
          this.apiKey = undefined; // Force immediate state unavailability
          return null;
        }
        if (response.status === 404) {
          console.warn(`[LLMClient:gemini] HTTP 404 Invalid model.`);
          this.lastError = { type: 'INVALID_MODEL', message: 'The selected model is invalid or unavailable.' };
          this.apiKey = undefined; // Force immediate state unavailability
          return null;
        }
        const errText = await response.text();
        console.warn(`[LLMClient:gemini] Gemini API HTTP ${response.status}: ${errText.slice(0, 200)}`);
        this.lastError = { type: 'PROVIDER_UNAVAILABLE', message: 'The provider returned an error.' };
        return null;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = parseAndValidateLLMResponse(rawText);
      if (!parsed) {
        this.lastError = { type: 'MALFORMED_RESPONSE', message: 'The provider returned an unusable response.' };
      }
      return parsed;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.warn(`[LLMClient:gemini] Request timed out after 15s.`);
        this.lastError = { type: 'TIMEOUT', message: 'The provider request timed out.' };
      } else {
        console.warn(`[LLMClient:gemini] Request error:`, err instanceof Error ? err.message : err);
        this.lastError = { type: 'PROVIDER_UNAVAILABLE', message: 'The provider could not be reached.' };
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Defensive JSON parser and validator for LLM output.
 */
export function parseAndValidateLLMResponse(rawText: string | undefined | null): LLMComparisonResponse | null {
  if (!rawText) return null;

  try {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    if (typeof parsed !== 'object' || parsed === null) return null;

    if (typeof parsed.sameSubject !== 'boolean') return null;
    if (typeof parsed.contradictory !== 'boolean') return null;

    let confidence = Number(parsed.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = parsed.contradictory ? 0.8 : 0.0;
    }

    const validCategories = ['STRUCTURAL', 'BEHAVIORAL', 'API_CONTRACT', 'CONFIGURATION', 'TESTING'];
    const category = validCategories.includes(parsed.category) ? parsed.category : 'BEHAVIORAL';

    return {
      sameSubject: parsed.sameSubject,
      contradictory: parsed.contradictory,
      confidence,
      category,
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      incompatibilityReason: typeof parsed.incompatibilityReason === 'string' ? parsed.incompatibilityReason : undefined,
      suggestedAuthoritativeSource: ['CLAIM_A', 'CLAIM_B', 'UNKNOWN'].includes(parsed.suggestedAuthoritativeSource)
        ? parsed.suggestedAuthoritativeSource
        : 'UNKNOWN',
    };
  } catch (err) {
    return null;
  }
}

export interface DiscoveredModel {
  id: string;
  name: string;
}

export interface DiscoveryResult {
  status: 'SUCCESS' | 'INVALID_API_KEY' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'NO_COMPATIBLE_MODELS' | 'DISCOVERY_UNSUPPORTED';
  models?: DiscoveredModel[];
}

export async function discoverProviderModels(provider: string, apiKey: string, baseURL?: string): Promise<DiscoveryResult> {
  if (!apiKey) return { status: 'INVALID_API_KEY' };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    if (provider === 'gemini') {
      const base = baseURL || 'https://generativelanguage.googleapis.com/v1beta';
      const res = await fetch(`${base}/models?key=${apiKey}`, { signal: controller.signal });
      if (res.status === 400 || res.status === 401 || res.status === 403) return { status: 'INVALID_API_KEY' };
      if (res.status === 429) return { status: 'RATE_LIMITED' };
      if (!res.ok) return { status: 'PROVIDER_UNAVAILABLE' };
      
      const data = await res.json();
      const models = (data.models || [])
        .filter((m: any) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName || m.name.replace('models/', '')
        }));
        
      if (!models.length) return { status: 'NO_COMPATIBLE_MODELS' };
      return { status: 'SUCCESS', models };
      
    } else if (provider === 'openai' || provider === 'groq') {
      const base = baseURL || (provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.groq.com/openai/v1');
      const res = await fetch(`${base}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal
      });
      if (res.status === 401 || res.status === 403) return { status: 'INVALID_API_KEY' };
      if (res.status === 429) return { status: 'RATE_LIMITED' };
      if (!res.ok) return { status: 'PROVIDER_UNAVAILABLE' };
      
      const data = await res.json();
      const models = (data.data || [])
        .filter((m: any) => {
          if (provider === 'openai') {
            return m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3');
          }
          return !m.id.includes('whisper'); // Filter out audio models for Groq
        })
        .map((m: any) => ({
          id: m.id,
          name: m.id
        }));
        
      if (!models.length) return { status: 'NO_COMPATIBLE_MODELS' };
      return { status: 'SUCCESS', models };
    }
    
    return { status: 'DISCOVERY_UNSUPPORTED' };
  } catch (err: any) {
    if (err.name === 'AbortError') return { status: 'PROVIDER_UNAVAILABLE' };
    return { status: 'PROVIDER_UNAVAILABLE' };
  } finally {
    clearTimeout(timeoutId);
  }
}

