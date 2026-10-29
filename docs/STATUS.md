# Project status

_Last updated: 2026-10-29_

## What this is

Next.js 16 app on Vercel that plans 10 Adobe Stock image briefs, generates JPEGs via OpenRouter, saves batches to a private Vercel Blob store and emails results via SMTP2GO. See `README.md` for features and env vars.

## Done recently

- **Manual research batch no longer tied to one date** (2026-10-29). The dashboard button "สร้างชุดวิจัย 10 ภาพ" reads the newest `research/manual-prompts-YYYY-MM-DD.md`. Category, keywords and an optional face-safe fallback prompt now live in that file, not in code. Format: `research/README.md`.
- Security quick audit + Next.js 16.4.3 upgrade — `docs/security/AUDIT-2026-10-29.md`.
- Email addresses removed from code; `RECIPIENT_EMAIL` and `SENDER_EMAIL` are now **required** env vars (no email is sent without them).
- Earlier: sold-image expansion tab, manual research batch with "retry missing images", food-fusion de-duplication.

## Open / blocked

- New research flow not yet clicked on the live site (would spend OpenRouter credit). First real run will confirm it.
- Login rate limit is **live** in Vercel Firewall (2026-10-29, rule `Login rate limit`): POST `/api/auth/login`, 10 requests / 600 s per IP → 429. Hobby allows only 1 rate-limit rule per project. Lives in Vercel, not git. Not yet tested with 11 real wrong-password attempts.
- Confirm `RECIPIENT_EMAIL` and `SENDER_EMAIL` are set in Vercel (Production) before the next run, or emails will stop.
- `vercel.json` has `"crons": []` — the daily 18:00 cron is currently **off**; README still describes it as on.
- `research/manual-prompts-2026-10-28.md` intro still says the prompts are "not added to the pipeline" (outdated wording).

## Next steps

1. Write the next research file (`research/manual-prompts-<date>.md`), run `npm test`, deploy, click the research button.
2. Decide on the audit's open items.
3. Consider splitting `app/page.tsx` (~1,900 lines).

## Gotchas

- Read `node_modules/next/dist/docs/` before Next.js changes (AGENTS.md) — this Next version differs from older docs.
- Files read at runtime must be listed in `outputFileTracingIncludes` (`next.config.ts`) or Vercel won't bundle them.
- `npm test` compiles to `.test-dist/` then deletes it. The OpenRouter `TimeoutError` lines during tests are expected (simulated).
- Research briefs must be exactly 10, numbered 1–10, each with `- Category:` and ≥15 `- Keywords:`, or the batch is refused before any paid call.

## Setting up a new machine

```bash
git clone https://github.com/diowcnx/adobe_stock.git
cd adobe_stock
npm install
cp .env.example .env.local   # then fill in real values
npm test
npm run dev
```

**Not in git (only on the old machine / in Vercel):** `.env.local` secrets (OpenRouter, SMTP2GO, admin password, session/cron secrets), Vercel project link (`.vercel/`), and anything in `output/` that was not committed. Real env values live in Vercel → Project Settings → Environment Variables.
