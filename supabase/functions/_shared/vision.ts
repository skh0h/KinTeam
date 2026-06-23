/**
 * _shared/vision.ts
 *
 * Shared helpers for Edge Functions that fetch an image from Supabase Storage
 * and pass it to a Gemini vision model.
 *
 * Extracted from analyze-chore-photo and analyze-team-lift-photo and hardened:
 * the original per-function copies had no SSRF guard, no host allowlist, no protocol
 * check, and no redirect:'manual'. This shared version adds all of those protections.
 */

// ─── SSRF guard ───────────────────────────────────────────────────────────────

/**
 * Validates that `file_url` points at this project's Supabase Storage only.
 *
 * Allowed URL shapes:
 *   https://<supabase-host>/storage/v1/object/public/...
 *   https://<supabase-host>/storage/v1/object/sign/...
 *
 * Returns null when the URL is safe; returns a Response to send immediately
 * when it is not.
 */
export function validateStorageUrl(
  file_url: string,
  corsHeaders: Record<string, string>,
): Response | null {
  const supabaseBase = Deno.env.get('SUPABASE_URL') ?? 'https://djnhsgfldbizgqfdpayn.supabase.co';
  const allowedHost = new URL(supabaseBase).host;

  let parsed: URL;
  try {
    parsed = new URL(file_url);
  } catch {
    return Response.json({ error: 'invalid file_url' }, { status: 400, headers: corsHeaders });
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.host !== allowedHost ||
    !(
      parsed.pathname.startsWith('/storage/v1/object/public/') ||
      parsed.pathname.startsWith('/storage/v1/object/sign/')
    )
  ) {
    return Response.json({ error: 'invalid file_url' }, { status: 400, headers: corsHeaders });
  }

  return null; // URL is safe
}

// ─── Image fetch + base64 ─────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
]);

export type FetchImageResult =
  | { ok: true; mimeType: string; base64: string }
  | { ok: false; response: Response };

/**
 * Fetches the image at `file_url`, validates MIME type, and returns a base64
 * string + MIME type suitable for Gemini's inline_data part.
 *
 * redirect:'manual' is intentional — prevents SSRF bypass via open-redirect.
 */
export async function fetchImageAsBase64(
  file_url: string,
  corsHeaders: Record<string, string>,
): Promise<FetchImageResult> {
  const imgRes = await fetch(file_url, { redirect: 'manual' });
  if (imgRes.status >= 300 && imgRes.status < 400) {
    return {
      ok: false,
      response: Response.json({ error: 'invalid file_url' }, { status: 400, headers: corsHeaders }),
    };
  }

  const rawMime = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!ALLOWED_MIME.has(rawMime)) {
    return {
      ok: false,
      response: Response.json(
        { error: 'unsupported image type' },
        { status: 400, headers: corsHeaders },
      ),
    };
  }

  const buffer = await imgRes.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return { ok: true, mimeType: rawMime, base64: btoa(binary) };
}
