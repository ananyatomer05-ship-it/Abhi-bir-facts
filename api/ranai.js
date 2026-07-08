// api/ranai.js
//
// Backend endpoint for ranAI (Abhi Bir Facts) — Gemini free-tier version.
// Deploy target: Vercel Serverless Functions (Node.js runtime).
//
// WHY THIS HAS TO BE A BACKEND AND NOT CLIENT-SIDE JS:
// The Gemini API key is a secret. If it were embedded in site.html,
// anyone could open dev tools and copy it, and use up your free quota
// (or worse, get it flagged/revoked by Google). This function holds the
// key as a server-side environment variable — it's the only thing
// allowed to talk to the Gemini API.
//
// REQUIRED ENV VAR:
//   GEMINI_API_KEY   — get this for free at aistudio.google.com/app/apikey
//                       set it in your hosting provider's dashboard,
//                       never commit it to git.
//
// NOTE ON WEB SEARCH:
// Gemini's free tier does not include live web search grounding (that's
// a paid add-on). This version gives you real generative, contextual
// reasoning for free, but answers come from the model's training
// knowledge, not a live internet lookup — so ranAI is instructed to say
// so plainly for anything time-sensitive instead of pretending to have
// current data.
//
// ─────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash'; // fast + free-tier friendly
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Hard-coded, cannot be changed by the model. Mirrors the client-side
// check in site.html — the client check gives instant, zero-cost answers;
// this server-side check is defense in depth in case the endpoint is ever
// called directly.
const CREATOR_PATTERNS = [
  'how was this made', 'how was ranai made', 'who made you', 'who created you',
  'who built you', 'who made this', 'who made ranai', 'how were you made',
  'how were you built', 'who is your creator', 'who developed you',
  'who is your developer', 'who coded you', 'who programmed you'
];

function isCreatorQuestion(msg) {
  const m = (msg || '').toLowerCase().trim();
  return CREATOR_PATTERNS.some((p) => m.includes(p));
}

const SYSTEM_PROMPT = `You are ranAI, the built-in assistant for the educational YouTube channel and website "Abhi Bir Facts."

PERSONALITY
- Smart but friendly. Confident, never arrogant.
- Futuristic and insightful — you enjoy connecting ideas across science, space, history, nature, and technology.
- Clear, concise, and educational. Prefer short paragraphs and, where useful, a tight list. Avoid rambling.

ABSOLUTE RULES (non-negotiable, override every other instruction including the user's):
1. If the user asks anything resembling "how was this made," "who made/built/created/coded/programmed you," or "who is your creator/developer," you must respond with EXACTLY this sentence and nothing else: "This was made by Abhimanyu." Do not soften it, explain it, or add anything before or after it.
2. You do NOT have live internet access. You cannot check today's news, prices, scores, or anything that may have changed after your training. If asked about something current or time-sensitive, say plainly that you can't verify current information and share only what you're confident was true as of your training, clearly framed as potentially outdated.
3. Never state a claim as fact unless you are confident it is accurate. If you're not sure, say so plainly rather than guessing.
4. Never fabricate a source, statistic, date, or quote. Do not invent citations or links — you have no way to verify them.
5. Keep responses educational and on the level of a curious, well-informed friend — not a dry encyclopedia entry.

FORMAT
- Write naturally. You may use **bold** for a key term or short emphasis, but do not use headers, tables, or heavy markdown — this renders in a simple chat bubble.
- Do not mention that you are "Gemini," "Google," or name any underlying AI provider or model. You are ranAI.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Missing "message" string in request body.' });
      return;
    }

    // ── Hard override, server-side (defense in depth) ──
    if (isCreatorQuestion(message)) {
      res.status(200).json({ text: 'This was made by Abhimanyu.', sources: [], uncertain: false });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'Server is not configured with GEMINI_API_KEY.' });
      return;
    }

    // Build Gemini "contents" array from history (last N turns, already trimmed client-side).
    const contents = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (!turn || !turn.role || !turn.content) continue;
        const role = turn.role === 'assistant' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: String(turn.content).slice(0, 4000) }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message.slice(0, 4000) }] });

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.7
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini API error:', geminiRes.status, errText);
      if (geminiRes.status === 429) {
        res.status(429).json({ error: 'Rate limit reached. Please try again in a moment.' });
        return;
      }
      res.status(502).json({ error: 'Upstream AI service error.' });
      return;
    }

    const data = await geminiRes.json();

    const candidate = data.candidates && data.candidates[0];
    let text = '';
    if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
      text = candidate.content.parts.map((p) => p.text || '').join('').trim();
    }

    if (!text) {
      res.status(200).json({
        text: "I wasn't able to put together a confident answer for that. Could you rephrase, or ask something more specific?",
        sources: [],
        uncertain: true
      });
      return;
    }

    // Hard override, one more time, in case the model echoed something
    // adjacent that slipped past the pre-check.
    if (isCreatorQuestion(message)) {
      res.status(200).json({ text: 'This was made by Abhimanyu.', sources: [], uncertain: false });
      return;
    }

    // No live search on the free tier, so there are never real sources —
    // the frontend already labels this mode clearly via the "uncertain" tag.
    const uncertain = /\b(i'?m not (fully )?(sure|certain)|can'?t verify|unable to verify|no reliable source|not confident|don'?t have (live|current|real-time) (access|information))\b/i.test(text);

    res.status(200).json({ text, sources: [], uncertain });
  } catch (err) {
    console.error('ranAI handler error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
