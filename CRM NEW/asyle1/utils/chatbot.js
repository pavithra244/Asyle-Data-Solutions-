// ============================================================
// utils/chatbot.js — Asyle Data Solutions
// Google Gemini AI Chatbot (built from scratch)
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── Config from .env ─────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// BUG FIX: Guard against NaN when env vars are missing or non-numeric
const MAX_TOKENS = (() => {
    const v = parseInt(process.env.GEMINI_MAX_TOKENS || '1024', 10);
    return isNaN(v) || v <= 0 ? 1024 : v;
})();

const TEMPERATURE = (() => {
    const v = parseFloat(process.env.GEMINI_TEMPERATURE || '0.7');
    return isNaN(v) || v < 0 || v > 2 ? 0.7 : v;
})();

const HISTORY_LIMIT = (() => {
    const v = parseInt(process.env.GEMINI_HISTORY_LIMIT || '10', 10);
    return isNaN(v) || v <= 0 ? 10 : v;
})();

// ── Persona / System Prompt ──────────────────────────────────
const SYSTEM_INSTRUCTION = `
You are the official AI support assistant for Asyle Data Solutions, a professional 
data management and consulting company based in India.

Your responsibilities:
- Help customers with questions about their account, publications, and services.
- Answer questions about Asyle's services: PhD content writing, article publication,
  book publication, data analytics, data collection, case studies, research consultancy,
  and journal submission.
- Guide users on how to use the customer portal (dashboard, downloading publications,
  checking account status).
- If a question requires human help (billing, urgent issues, account denial disputes, 
  file access problems), or if the user explicitly asks to talk to a person/admin:
  1. Politely inform them that a support agent will be with them shortly.
  2. Mention they can also email: ${process.env.ADMIN_EMAIL || 'support@asyledatasolutions.com'}.
  3. MANDATORY: Include the tag [HUMAN_REQUEST] at the very end of your response.

Rules:
- Always be professional, warm, and concise.
- Never reveal API keys, database info, server details, or staff information.
- Never make up specific prices — say "please contact our team for a quote".
- If asked who you are: "I'm the Asyle AI Assistant, here to help while our team is away."
- Respond in the same language the user writes in.
- Keep replies focused — no unnecessary padding.
`.trim();

// ── Per-user conversation memory (keyed by userId) ───────────
// Stores Gemini-format history: [{ role: 'user'|'model', parts: [{text}] }]
const histories = new Map();

// ── Gemini client (lazy init) ────────────────────────────────
let genAI = null;
function getClient() {
    if (!API_KEY) throw new Error('GEMINI_API_KEY is not set in .env');
    if (!genAI) genAI = new GoogleGenerativeAI(API_KEY);
    return genAI;
}

// ── Trim history to avoid memory bloat ──────────────────────
function trimHistory(history) {
    const max = HISTORY_LIMIT * 2; // each turn = 2 entries (user + model)
    return history.length > max ? history.slice(history.length - max) : history;
}

// BUG FIX: Sanitize userId to prevent unsafe Map keys
function sanitizeUserId(userId) {
    return String(userId).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 64) || 'default';
}

// BUG FIX: Wrap Gemini call in a timeout to prevent indefinite hangs
function withTimeout(promise, ms = 15000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Gemini API timeout')), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

// ============================================================
//  getChatbotReply(userMessage, userId, context)
//  → Returns a string reply from Gemini
//  → context (optional): additional info (like publications list)
// ============================================================
async function getChatbotReply(userMessage, userId = 'default', context = '') {
    if (!userMessage || !String(userMessage).trim()) {
        return "I didn't quite catch that — could you rephrase?";
    }

    // BUG FIX: Sanitize userId before using as Map key
    const safeUserId = sanitizeUserId(userId);

    // Get or init history for this user
    if (!histories.has(safeUserId)) histories.set(safeUserId, []);
    const history = histories.get(safeUserId);

    // Prepare dynamic system instruction
    let fullSystemInstruction = SYSTEM_INSTRUCTION;
    if (context) {
        fullSystemInstruction += `\n\nCONTEXT INFORMATION (Available data you can refer to):\n${context}`;
    }

    const trimmedMessage = String(userMessage).trim();

    try {
        const model = getClient().getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: fullSystemInstruction,
            generationConfig: {
                maxOutputTokens: MAX_TOKENS,
                temperature: TEMPERATURE,
            }
        });

        // Resume conversation with existing history
        const chat = model.startChat({ history: [...history] }); // BUG FIX: pass a copy so partial failures don't corrupt state

        // BUG FIX: Wrap in timeout to prevent indefinite hanging
        const result = await withTimeout(chat.sendMessage(trimmedMessage), 15000);
        const reply = result.response.text();

        // BUG FIX: Only save to history AFTER successfully getting a reply
        history.push({ role: 'user', parts: [{ text: trimmedMessage }] });
        history.push({ role: 'model', parts: [{ text: reply }] });
        histories.set(safeUserId, trimHistory(history));

        return reply;

    } catch (err) {
        console.error('[Gemini Chatbot Error]', err.message || err);

        if (!API_KEY) {
            return 'The AI assistant is not configured yet. Please wait for a support agent.';
        }
        if (err.message === 'Gemini API timeout') {
            return "I'm taking too long to respond right now. Please wait for a live support agent or try again shortly.";
        }
        if (err.status === 429) {
            return "I'm a little overwhelmed right now. Please try again in a moment, or wait for a live agent.";
        }
        return "I'm having trouble connecting right now. A support agent will be with you soon — or email us at " +
            (process.env.ADMIN_EMAIL || 'support@asyledatasolutions.com') + '.';
    }
}

// ── Clear history when user logs out ────────────────────────
function clearHistory(userId) {
    const safeUserId = sanitizeUserId(userId);
    histories.delete(safeUserId);
}

module.exports = { getChatbotReply, clearHistory };