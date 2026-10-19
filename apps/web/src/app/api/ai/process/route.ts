import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AI_PROMPTS, type AIOperation } from '@/lib/services/ai';

const VALID_OPERATIONS: AIOperation[] = [
  'summarize', 'extract_tasks', 'suggest_title', 'suggest_tags',
  'rewrite', 'fix_grammar', 'change_tone', 'translate',
  'generate_outline', 'meeting_summary',
];

const MAX_CONTENT_LENGTH = 20000; // characters — prevent runaway costs

export async function POST(request: NextRequest) {
  // Validate auth if Supabase is configured
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Validate OpenAI key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI is not configured. Add OPENAI_API_KEY to your .env.local file.' },
      { status: 503 }
    );
  }

  // Parse and validate request
  let body: { operation: AIOperation; content: string; options?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { operation, content, options = {} } = body;

  if (!VALID_OPERATIONS.includes(operation)) {
    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  }

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content too long. Maximum ${MAX_CONTENT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // Build prompt
  const promptFn = AI_PROMPTS[operation];
  const prompt = promptFn(content, options);

  // Call OpenAI
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant for a personal notes app called FlowNote AI. ' +
              'Be concise, accurate, and preserve the user\'s original voice. ' +
              'Never fabricate facts, people, dates, or commitments. ' +
              'When uncertain, say so explicitly.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = (err as Record<string, Record<string, string>>)?.error?.message ?? 'OpenAI request failed';
      return NextResponse.json({ error: msg }, { status: response.status });
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
      usage: { total_tokens: number };
      model: string;
    };
    const result = data.choices[0]?.message?.content ?? '';

    return NextResponse.json({
      result,
      tokens_used: data.usage?.total_tokens,
      provider: 'openai',
      model: data.model,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI request failed';
    if (msg.includes('timeout') || msg.includes('signal')) {
      return NextResponse.json({ error: 'AI request timed out. Try again.' }, { status: 504 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
