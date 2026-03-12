/**
 * Cloudflare Pages Function: /api/ai-search
 * Uses Workers AI (llama-3.1-8b-instruct) with structured JSON output
 * to return up to 10 SoundCloud track suggestions for a query.
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

  const systemPrompt = `You are a SoundCloud music search assistant. Given a song name, artist, or description, return up to 10 real SoundCloud tracks that best match.

Rules:
- Only include tracks you are confident exist on SoundCloud.
- SoundCloud URLs must follow: https://soundcloud.com/{artist-slug}/{track-slug}
- Use lowercase with hyphens for slugs (e.g. "daft-punk", "get-lucky").
- Include a mix of the most popular/official tracks matching the query.
- If you cannot find any matching tracks, return an empty array.
- Do NOT make up or guess URLs. Only include tracks you know exist.`;

  const userMessage = `Find up to 10 SoundCloud tracks for: "${query}"`;

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

    const raw = (aiResponse?.response || '').trim();

    if (!raw) {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    let parsed;
    try {
      const cleaned = raw.replace(/```json|```/gi, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : cleaned);
    } catch {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    const rawTracks = parsed?.tracks;
    if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    // Validate and sanitise each track
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
