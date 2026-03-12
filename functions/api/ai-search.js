/**
 * Cloudflare Pages Function: /api/ai-search
 * Uses Workers AI (llama-3.1-8b-instruct) to convert a song name query
 * into a SoundCloud URL.
 *
 * SETUP REQUIRED in Cloudflare Dashboard:
 *   Workers & Pages → your project → Settings → Bindings → Add
 *   Type: Workers AI  |  Variable name: AI
 *   Then redeploy.
 */

export async function onRequestPost(context) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Handle preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Check AI binding exists
  if (!context.env.AI) {
    return Response.json(
      { error: 'Workers AI binding not configured. Add an AI binding named "AI" in your Pages project settings.' },
      { status: 503, headers }
    );
  }

  // Parse request body
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

  // Build prompt for LLM
  const systemPrompt = `You are a music URL assistant. Your ONLY job is to return a valid SoundCloud URL for the song the user is looking for.

Rules:
- Return ONLY a JSON object, no explanation, no markdown.
- If you can identify the track, return: {"url": "https://soundcloud.com/artist-slug/track-slug", "title": "Artist - Track Name"}
- The URL format must be exactly: https://soundcloud.com/{artist-slug}/{track-slug}
- Use lowercase, hyphens instead of spaces for slugs.
- If you cannot identify a specific SoundCloud track with confidence, return: {"notFound": true}
- Do NOT guess or make up URLs. Only return URLs you are confident exist.
- Do NOT return playlist URLs unless the user specifically asked for a playlist.`;

  const userMessage = `Find the SoundCloud URL for: "${query}"`;

  try {
    const aiResponse = await context.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 120,
      temperature: 0.1, // Low temperature = more deterministic, less hallucination
    });

    // Extract text from response
    const raw = (aiResponse?.response || aiResponse?.result?.response || '').trim();

    if (!raw) {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    // Parse JSON from AI response (strip any markdown fences just in case)
    const cleaned = raw.replace(/```json|```/gi, '').trim();
    let parsed;
    try {
      // Extract first JSON object in the response
      const match = cleaned.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('No JSON object found');
      parsed = JSON.parse(match[0]);
    } catch {
      // AI returned something non-JSON
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    // Validate the URL looks like a real SoundCloud track URL
    if (parsed.notFound) {
      return Response.json({ notFound: true }, { status: 200, headers });
    }

    if (parsed.url) {
      try {
        const u = new URL(parsed.url);
        const isSoundCloud = u.hostname === 'soundcloud.com' || u.hostname === 'www.soundcloud.com';
        // Must have at least /artist/track (2 path segments)
        const segments = u.pathname.split('/').filter(Boolean);
        if (!isSoundCloud || segments.length < 2) {
          return Response.json({ notFound: true }, { status: 200, headers });
        }
      } catch {
        return Response.json({ notFound: true }, { status: 200, headers });
      }

      return Response.json(
        { url: parsed.url, title: parsed.title || parsed.url },
        { status: 200, headers }
      );
    }

    return Response.json({ notFound: true }, { status: 200, headers });

  } catch (err) {
    return Response.json(
      { error: 'Workers AI error: ' + err.message },
      { status: 500, headers }
    );
  }
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}
