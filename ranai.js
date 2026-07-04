// api/ranai.js
//
// Backend endpoint for ranAI (Abhi Bir Facts).
// Deploy target: Vercel Serverless Functions (Node.js runtime).
// If you host elsewhere, see server.js for an Express equivalent — the
// logic in this file is what actually matters; the wrapper just adapts it
// to whatever platform you deploy to.
//
// WHY THIS HAS TO BE A BACKEND AND NOT CLIENT-SIDE JS:
// The Anthropic API key is a secret. If it were embedded in site.html,
// anyone could open dev tools, copy it, and run up your bill (or worse).
// This function holds the key as a server-side environment variable and
// is the only thing allowed to talk to the Anthropic API.
//
// REQUIRED ENV VAR:
//   ANTHROPIC_API_KEY   — set this in your hosting provider's dashboard,
//                          never commit it to git.
//
// ─────────────────────────────────────────────────────────────────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6'; // swap for whichever current model you have access to

// Hard-coded, cannot be changed by the model. This mirrors the client-side
// check in site.html — the client check gives instant, zero-cost answers;
// this server-side check is defense in depth in case the endpoint is ever
// called directly (e.g. from a different frontend, or a script).
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
2. Never state a claim as fact unless you are confident it is accurate and, for anything time-sensitive, factual, or checkable, you have used the web_search tool to verify it in this conversation.
3. If you searched and still aren't confident, or the search tool returned nothing useful, say so plainly (e.g. "I couldn't verify this — here's what I found, but treat it with caution") rather than guessing.
4. Never fabricate a source, statistic, date, or quote.
5. Keep responses educational and on the level of a curious, well-informed friend — not a dry encyclopedia entry.

WHEN TO SEARCH
- Use web_search for anything current, time-sensitive, a specific statistic, a claim you're not fully certain of, or anything explicitly about "now," "latest," "recent," "current," etc.
- You do not need to search for stable, well-established facts (e.g. basic physics, historical dates that don't change) you're already confident about — but if in doubt, search.

FORMAT
- Write naturally. You may use **bold** for a key term or short emphasis, but do not use headers, tables, or heavy markdown — this renders in a simple chat bubble.
- Do not mention that you are "Claude" or name any underlying AI provider or model. You are ranAI.`;

module.exports = async function handler(req, res) {
  // Basic CORS / preflight support so the frontend's status probe works.
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

    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'Server is not configured with ANTHROPIC_API_KEY.' });
      return;
    }

    // Build message history for context (last N turns, trimmed client-side already).
    const messages = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (!turn || !turn.role || !turn.content) continue;
        const role = turn.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: String(turn.content).slice(0, 4000) });
      }
    }
    messages.push({ role: 'user', content: message.slice(0, 4000) });

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => '');
      console.error('Anthropic API error:', anthropicRes.status, errText);
      res.status(502).json({ error: 'Upstream AI service error.' });
      return;
    }

    const data = await anthropicRes.json();

    // Walk the content blocks: collect visible text and any web search
    // result citations the model attached to its claims.
    let text = '';
    const sources = [];
    const seenUrls = new Set();

    for (const block of data.content || []) {
      if (block.type === 'text') {
        text += block.text;
        // Anthropic returns citations attached to text blocks when the
        // web_search tool was used and the model cited a result.
        if (Array.isArray(block.citations)) {
          for (const c of block.citations) {
            if (c.url && !seenUrls.has(c.url)) {
              seenUrls.add(c.url);
              let domain = '';
              try { domain = new URL(c.url).hostname.replace(/^www\./, ''); } catch (e) {}
              sources.push({ title: c.title || domain, url: c.url, domain });
            }
          }
        }
      }
      // web_search_tool_result blocks also carry raw results; only surface
      // ones actually cited in text above to avoid dumping every hit.
    }

    text = text.trim();
    if (!text) {
      res.status(200).json({
        text: "I wasn't able to put together a confident answer for that. Could you rephrase, or ask something more specific?",
        sources: [],
        uncertain: true
      });
      return;
    }

    // Hard override, one more time, in case the model echoed something
    // adjacent that slipped past the pre-check (e.g. paraphrase of the question).
    if (isCreatorQuestion(message)) {
      res.status(200).json({ text: 'This was made by Abhimanyu.', sources: [], uncertain: false });
      return;
    }

    const uncertain = /\b(i'?m not (fully )?(sure|certain)|couldn'?t verify|unable to verify|no reliable source|not confident)\b/i.test(text) && sources.length === 0;

    res.status(200).json({ text, sources, uncertain });
  } catch (err) {
    console.error('ranAI handler error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
