# Aangan Enquiry Desk

Every phone enquiry to Aangan Studio (interior design, Pune) gets answered, qualified against the founder's own rubric, and handed to a designer with the details already collected. Built for MESA AI Case 3, "Nikhil: Unanswered Enquiries".

**The problem:** about 200 enquiries a month, roughly half unanswered within 48 hours, a third arriving outside desk hours, and an enquiry answered within an hour converting at four times the rate of a next-day reply.

## How it works

```
Caller -> Vaani voice agent -> call_postprocessing webhook -> Gemini qualification
       -> Telegram handoff note (forward / escalate / callback) -> call log -> cost dashboard
```

| Piece | Where | What it does |
|---|---|---|
| Voice agent | Vaani dashboard, prompt in `knowledge/agent_prompt.md` | Answers the call, asks one question at a time, never quotes a price |
| Webhook | `api/webhook.mjs` (Vercel) or `src/server.mjs` (local) | Receives the transcript after each call |
| Brain | `src/qualify.mjs` | Gemini reads the transcript with `services.md` and `qualified.md`, returns decision, extracted fields, flags and a handoff note |
| Handoff | `src/telegram.mjs` | Pushes leads, escalations and missed calls to Telegram. Declines are logged, not pushed |
| Log | `src/store.mjs` | Supabase (Postgres) on Vercel, a local file otherwise. Tables in `supabase/schema.sql` |
| Dashboard | `views/dashboard.html` | Calls handled, outcomes, hand-off time, cost per enquiry, break-even |

Decisions: `forward`, `decline`, `nurture`, `escalate`, `callback_needed`.

## The cut: no pricing on calls

Nikhil asked the system to quote per-sq-ft pricing. The internal guide is "indicative only, varies by site", and a wrong number on an 8-14 lakh project becomes a commitment. So the agent never has the pricing file, never quotes a number, and gives one approved deflection line. A price question never disqualifies a caller. `pricing.md` is deliberately not in this repository.

## Why Telegram, not email

Designers are mobile and on site, push notification is immediate, and speed is the whole premise (a reply within an hour converts at 4x). Email is slower to be seen. It can be added as a copy for the record.

## Extending to WhatsApp and the web form

Only the trigger and input change. Route their messages into the same `handleEvent` pipeline as a transcript and everything after it is shared. They are out of scope for this build.

## Results on the 20 September phone calls

`npm run test:calls` runs all 20 transcripts through the brain and compares them with `data/expected.json`: 20/20 match (12 forwarded, 5 declined, 1 escalated, 1 nurture, 1 missed call). The expected outcomes were written from the same rubric, so this shows the model follows the rubric, not that the rubric is right. Review the edge calls (T02, T07, T14, T15, T18) with the founder.

Known assumptions: a 500 sq ft minimum for commercial projects (used by the front desk on T18 but not in `services.md`), and 8-10 weeks lead time from `qualified.md` rather than the 6 weeks in `services.md`.

## Run it locally

```bash
npm install
cp .env.example .env        # fill in your keys
npm run test:calls          # 20-call accuracy check
npm run demo -- --no-telegram   # push all 20 through the full pipeline
npm run dashboard           # http://localhost:3001 (local only)
npm run webhook             # http://localhost:3000/webhook/<WEBHOOK_SECRET>
```

To receive real Vaani calls locally, expose port 3000 with `cloudflared tunnel --url http://localhost:3000` and paste `https://<tunnel>/webhook/<WEBHOOK_SECRET>` into Vaani, Developers, Webhooks, tick `call_postprocessing`.

## Deploy on Vercel

1. Import this repository at vercel.com/new.
2. In Supabase, create a project and run `supabase/schema.sql` in the SQL Editor. Row Level Security is on with no policies, so only the server key can read or write.
3. In Project Settings, Environment Variables, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase, Project Settings, API; the service_role key is secret and server-only), plus `LLM_API_KEY`, `LLM_PROVIDER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WEBHOOK_SECRET`, optionally `DASHBOARD_PASSWORD` (leave it out for an open dashboard), and optionally `GEMINI_MODEL`, `PRICE_IN_PER_M`, `PRICE_OUT_PER_M`. Use fresh values, not ones you have pasted anywhere.
4. Redeploy. The dashboard is at `/`; it asks for the password (any username) only if `DASHBOARD_PASSWORD` is set. The webhook is `https://<project>.vercel.app/webhook/<WEBHOOK_SECRET>`; paste it into Vaani.
5. Optional, to fill the dashboard with the 20 demo calls: set the two Supabase variables in your local `.env` and run `npm run demo -- --no-telegram`.

## Costs

Voice is about 98% of the running cost (estimated at 5.6 rupees a minute from the Vaani agent page); Gemini is a rounding error. At 200 enquiries a month the projection is roughly 5,000 rupees, against projects worth 8-14 lakh. The dashboard has editable assumptions for the voice rate, number cost, volume and conversion. The conversion figure is a placeholder, and the project-value break-even line is the one to rely on.

## Security notes

- Vaani webhooks carry no signature, so the endpoint is protected by a secret in the URL. Treat that URL like a password and rotate the secret if it leaks.
- The dashboard shows caller names, details and handoff notes. Login is optional: if `DASHBOARD_PASSWORD` is set it asks for it (any username); if it is not set the dashboard is **public**, so anyone with the URL sees every call. Set the variable to protect real caller data.
- `data/calls.json` holds the 20 anonymised September transcripts supplied with the case. Live call logs are git-ignored.
