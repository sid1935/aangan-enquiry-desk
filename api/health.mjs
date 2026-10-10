// Vercel function: public health check. Reports only whether storage is reachable. No data, no secrets, no error text.
import { ping } from '../src/store.mjs';

export default async function handler(req, res) {
  const status = await ping();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status.db === 'error' ? 503 : 200;
  res.end(JSON.stringify({ ok: status.db !== 'error', ...status, webhookSecretSet: !!process.env.WEBHOOK_SECRET, dashboardPasswordSet: !!process.env.DASHBOARD_PASSWORD, geminiKeySet: !!process.env.LLM_API_KEY, hubspotSet: !!process.env.HUBSPOT_TOKEN, telegramSet: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) }));
}
