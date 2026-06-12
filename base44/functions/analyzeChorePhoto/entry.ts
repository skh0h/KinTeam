import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url } = await req.json();
        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
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
                                text: `You are helping build a household chore card from a photo. Look at the photo and figure out what chore needs to be done (e.g. dirty dishes -> "Wash the dishes", messy lawn -> "Mow the lawn", overflowing bin -> "Take out the bins").

Return:
- title: a short, clear chore name (max 6 words)
- occurrence: how often this chore typically needs doing. One of: daily, weekly, fortnightly, monthly, as_needed
- stars: how much effort/reward it deserves from 1 (quick & easy) to 5 (big job)
- notes: one short helpful sentence describing what specifically needs doing based on the photo`
                            }
                        ]
                    }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: 'OBJECT',
                            properties: {
                                title: { type: 'STRING' },
                                occurrence: { type: 'STRING', enum: ['daily', 'weekly', 'fortnightly', 'monthly', 'as_needed'] },
                                stars: { type: 'NUMBER' },
                                notes: { type: 'STRING' }
                            },
                            required: ['title', 'occurrence', 'stars', 'notes']
                        }
                    }
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            return Response.json({ error: `Gemini API error: ${errText}` }, { status: 500 });
        }

        const data = await geminiRes.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const result = JSON.parse(text);

        return Response.json(result);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});