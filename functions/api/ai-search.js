/**
 * Cloudflare Pages Function: /api/ai-search
 * Uses Workers AI (llama-3.1-8b-instruct) to return up to 10 real
 * SoundCloud track suggestions for a query.
 *
 * SETUP REQUIRED in Cloudflare Dashboard:
 *   Workers & Pages → your project → Settings → Bindings → Add
 *   Type: Workers AI  |  Variable name: AI
 *   Then redeploy.
 */

export async function onRequestPost(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (!context.env.AI) {
    return Response.json(
      { error: 'Workers AI binding not configured. Add an AI binding named "AI" in your Pages project settings.' },
      { status: 503, headers }
    );
  }

  let query = '';
  try {
    const body = await context.request.json();
    query = (body.query || '').trim();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers });
  }

  if (!query) {
    return Response.json({ error: 'Query is required.' }, { status: 400, headers });
  }

  const systemPrompt = `You are a SoundCloud music search assistant.

Given a song name or artist, return up to 10 DISTINCT real SoundCloud tracks.

STRICT RULES:
1. Every URL must be unique — no duplicates allowed.
2. URL format: https://soundcloud.com/{artist-slug}/{track-slug} — lowercase, hyphens only.
3. Each result must be a DIFFERENT track slug. Never repeat the same base track with added words like "(official)", "(clean)", "(explicit)", "(audio)", "(remix)" unless those are genuinely different well-known releases.
4. Return at most 10 results. If you only know 3 real tracks, return 3 — do NOT pad with fake variations.
5. If you are not confident a track exists on SoundCloud, omit it entirely.
6. Do NOT hallucinate or invent URLs.`;

  const userMessage = `Find up to 10 real, distinct SoundCloud tracks for: "${query}"`;

  try {
    const aiResponse = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 800,
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          type: 'object',
          properties: {
            tracks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title:  { type: 'string' },
                  artist: { type: 'string' },
                  url:    { type: 'string' },
                },
                required: ['title', 'artist', 'url'],
              },
            },
          },
          required: ['tracks'],
        },
      },
    });

    // response_format may return object or string depending on CF runtime version
    let parsed;
    try {
      const raw = aiResponse?.response;
      if (raw === null || raw === undefined) {
        return Response.json({ notFound: true }, { status: 200, headers });
      }
      if (typeof raw === 'object') {
        parsed = raw;
      } else {
        const cleaned = String(raw).replace(/```json|```/gi, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match ? match[0] : cleaned);
      }
    } catch {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    const rawTracks = parsed?.tracks;
    if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    // Validate URL structure
    const validTracks = rawTracks
      .filter(t => t.url && t.title && t.artist)
      .filter(t => {
        try {
          const u = new URL(t.url);
          const isSC = u.hostname === 'soundcloud.com' || u.hostname === 'www.soundcloud.com';
          const segments = u.pathname.split('/').filter(Boolean);
          return isSC && segments.length >= 2;
        } catch { return false; }
      })
      // Deduplicate by URL (case-insensitive)
      .filter((t, idx, arr) => {
        const normalized = t.url.toLowerCase().replace(/\/$/, '');
        return arr.findIndex(x => x.url.toLowerCase().replace(/\/$/, '') === normalized) === idx;
      })
      // Deduplicate by track slug to catch "(clean)" "(explicit)" padding
      .filter((t, idx, arr) => {
        try {
          const slug = new URL(t.url).pathname.split('/').filter(Boolean)[1];
          // Strip common padding suffixes to get base slug
          const base = slug
            .replace(/[-_]?(official|audio|video|clean|explicit|lyrics|hd|hq|remix|remaster)([-_]|$).*/i, '')
            .toLowerCase();
          return arr.findIndex(x => {
            try {
              const s = new URL(x.url).pathname.split('/').filter(Boolean)[1];
              const b = s.replace(/[-_]?(official|audio|video|clean|explicit|lyrics|hd|hq|remix|remaster)([-_]|$).*/i, '').toLowerCase();
              return b === base;
            } catch { return false; }
          }) === idx;
        } catch { return true; }
      })
      .slice(0, 10)
      .map(t => ({
        title:  t.title,
        artist: t.artist,
        url:    t.url,
      }));

    if (validTracks.length === 0) {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    return Response.json({ tracks: validTracks }, { status: 200, headers });

  } catch (err) {
    return Response.json(
      { error: 'Workers AI error: ' + err.message },
      { status: 500, headers }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
