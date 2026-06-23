/**
 * analyze-event-photo
 *
 * AI photo analysis Edge Function for the Events feature.
 * Given a photo URL, returns a suggested recurring family event:
 *   { title, cadence, days, notes }
 *
 * cadence is constrained to: 'nightly' | 'weekly' | 'semiweekly' | 'fortnightly'
 * days is an array of lowercase weekday strings (may be [] for nightly).
 *
 * Caller: base44.functions.invoke('analyzeEventPhoto', { file_url })
 * Response: { data: { title, cadence, days, notes } }
 */

import { CORS_HEADERS } from '../_shared/cron.ts';
import { validateStorageUrl, fetchImageAsBase64 } from '../_shared/vision.ts';

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {
    const { file_url } = await req.json();
    if (!file_url) {
      return Response.json(
        { error: 'file_url is required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // SSRF guard: reject URLs that don't point at this project's Supabase Storage
    const ssrfError = validateStorageUrl(file_url, CORS_HEADERS);
    if (ssrfError) return ssrfError;

    // Fetch the uploaded photo and base64-encode it
    const imgResult = await fetchImageAsBase64(file_url, CORS_HEADERS);
    if (!imgResult.ok) return imgResult.response;

    const { mimeType, base64 } = imgResult;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              {
                text: `You are helping a family set up a recurring household event from a photo. Look at the photo and figure out what regular activity or routine the family might want to schedule (e.g. a sports jersey -> "Soccer Practice", a dinner table -> "Family Dinner", a book -> "Reading Time").

Return:
- title: a short, clear event name (max 6 words)
- cadence: how often this event typically recurs. One of: nightly, weekly, semiweekly, fortnightly
  - nightly: every single day
  - weekly: once a week
  - semiweekly: twice a week
  - fortnightly: once every two weeks
- days: an array of lowercase weekday names indicating which day(s) of the week the event falls on (e.g. ["monday"] for weekly, ["tuesday","thursday"] for semiweekly). Use [] for nightly (it runs every day).
- notes: one short helpful sentence describing the event based on what's visible in the photo`,
              },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                cadence: {
                  type: 'STRING',
                  enum: ['nightly', 'weekly', 'semiweekly', 'fortnightly'],
                },
                days: {
                  type: 'ARRAY',
                  items: {
                    type: 'STRING',
                    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                  },
                },
                notes: { type: 'STRING' },
              },
              required: ['title', 'cadence', 'days', 'notes'],
            },
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return Response.json(
        { error: 'AI analysis failed' },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const result = JSON.parse(text);

    return Response.json(result, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Unhandled error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
