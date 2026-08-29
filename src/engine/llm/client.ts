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
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

export class LLMClient {
  private apiKey: string | undefined;
  private model: string;
  private baseURL: string;

  constructor(config?: LLMProviderConfig) {
    this.apiKey = config?.apiKey || process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    this.model = config?.model || process.env.LLM_MODEL || 'gemini-2.5-flash';
    this.baseURL = config?.baseURL || process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async compareClaims(req: LLMComparisonRequest): Promise<LLMComparisonResponse | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const prompt = this.buildPrompt(req);

    try {
      // Determine endpoint based on provider or key prefix
      if (this.apiKey?.startsWith('sk-') && !this.baseURL.includes('generativelanguage')) {
        return await this.callOpenAIFormat(prompt);
      } else {
        return await this.callGeminiFormat(prompt);
      }
    } catch (error) {
      console.warn('[LLMClient] Request failed:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  private buildPrompt(req: LLMComparisonRequest): string {
    return `You are a precise software engineering semantic judge analyzing two extracted claims from a repository for potential contradictions.

CLAIM A:
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
\`\`\`

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

Return ONLY a valid, raw JSON object matching this TypeScript interface without markdown wrapping (no \`\`\`json):
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

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[LLMClient] Gemini API HTTP ${response.status}: ${errText}`);
        return null;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return parseAndValidateLLMResponse(rawText);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callOpenAIFormat(prompt: string): Promise<LLMComparisonResponse | null> {
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
          model: this.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[LLMClient] OpenAI API HTTP ${response.status}: ${errText}`);
        return null;
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content;
      return parseAndValidateLLMResponse(rawText);
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
    // Strip code fence if model included it
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
