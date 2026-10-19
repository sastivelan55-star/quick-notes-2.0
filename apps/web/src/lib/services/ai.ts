/**
 * FlowNote AI — AI Service (Provider-Independent)
 *
 * All AI operations go through this service layer.
 * When OpenAI is not configured, operations return an 'unavailable' result.
 * Content is never sent to AI without going through this layer.
 */

export type AIOperation =
  | 'summarize'
  | 'extract_tasks'
  | 'suggest_title'
  | 'suggest_tags'
  | 'rewrite'
  | 'fix_grammar'
  | 'change_tone'
  | 'translate'
  | 'generate_outline'
  | 'meeting_summary';

export interface AIResult {
  status: 'success' | 'error' | 'unavailable';
  result: string | null;
  error?: string;
  tokens_used?: number;
  provider?: string;
  model?: string;
}

// ─── Client-side AI trigger ───────────────────────────────────────
// AI calls are made to our own API routes, never directly to OpenAI from the client.
// This keeps the API key server-side only.
export async function runAIOperation(
  operation: AIOperation,
  content: string,
  options: Record<string, string> = {}
): Promise<AIResult> {
  try {
    const response = await fetch('/api/ai/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, content, options }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      if (response.status === 503) {
        return { status: 'unavailable', result: null, error: err.error };
      }
      return { status: 'error', result: null, error: err.error ?? 'AI request failed' };
    }

    const data = await response.json();
    return {
      status: 'success',
      result: data.result,
      tokens_used: data.tokens_used,
      provider: data.provider,
      model: data.model,
    };
  } catch (err) {
    return {
      status: 'error',
      result: null,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

// ─── Prompt templates ─────────────────────────────────────────────
export const AI_PROMPTS: Record<AIOperation, (content: string, opts: Record<string, string>) => string> = {
  summarize: (c) => `Summarize the following note concisely in 2-4 sentences. Preserve key information.\n\n---\n${c}`,
  extract_tasks: (c) => `Extract all action items and tasks from the following text. Return as a JSON array of strings.\n\n---\n${c}`,
  suggest_title: (c) => `Suggest a concise, descriptive title for this note (max 8 words). Return only the title, no quotes.\n\n---\n${c}`,
  suggest_tags: (c) => `Suggest 3-5 relevant tags for this note. Return as a JSON array of lowercase strings.\n\n---\n${c}`,
  rewrite: (c, o) => `Rewrite the following text to be ${o.style ?? 'clearer and more professional'}. Preserve the meaning.\n\n---\n${c}`,
  fix_grammar: (c) => `Fix the grammar and spelling in the following text. Return only the corrected text.\n\n---\n${c}`,
  change_tone: (c, o) => `Rewrite the following text in a ${o.tone ?? 'professional'} tone. Preserve the meaning.\n\n---\n${c}`,
  translate: (c, o) => `Translate the following text to ${o.language ?? 'English'}.\n\n---\n${c}`,
  generate_outline: (c) => `Generate a structured outline for the following content.\n\n---\n${c}`,
  meeting_summary: (c) => `From the following meeting notes or transcript, extract:\n1. Executive summary (2-3 sentences)\n2. Key discussion points (bullet list)\n3. Decisions made\n4. Action items (with owners if mentioned)\n5. Open questions\n\nFormat as structured markdown.\n\n---\n${c}`,
};
