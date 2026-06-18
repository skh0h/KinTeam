const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Fetch the uploaded photo and base64-encode it
    const imgRes = await fetch(file_url);
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const phaseSchema = {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        notes: { type: 'STRING' },
        steps: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['title', 'notes', 'steps']
    };

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
                text: `You are helping plan a big household "Team Lift" project from a photo. Look at the photo and figure out what big job needs doing (e.g. a cluttered garage -> "Garage Clean-Out", an overgrown garden -> "Garden Overhaul").

Break the job into 3 phases:
- prep: getting ready (gathering supplies, clearing space, planning)
- execution: doing the main work
- verification: checking quality, finishing touches, cleanup

Return:
- project_name: a short, clear project name (max 6 words)
- prep / execution / verification: each with a title (short phase description), notes (one helpful sentence), and steps (2-4 short, concrete action steps based on what's visible in the photo)`
              }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                project_name: { type: 'STRING' },
                prep: phaseSchema,
                execution: phaseSchema,
                verification: phaseSchema
              },
              required: ['project_name', 'prep', 'execution', 'verification']
            }
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return Response.json(
        { error: `Gemini API error: ${errText}` },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const result = JSON.parse(text);

    return Response.json(result, { headers: CORS_HEADERS });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
