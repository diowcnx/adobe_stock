# Project status

_Last updated: 2026-10-31_

## What this is

Command-line tool that generates 10 Adobe Stock JPEGs plus `metadata.csv` through OpenRouter. There is no website, dashboard, email or cloud storage. See `AGENTS.md` for how to run it.

## Done recently

- **First รีเสิร์ช batch** (2026-10-31): 28 keywords counted, 10 briefs in `research/manual-prompts-2026-10-31.md`, 10/10 saved after removing people from one brief that kept failing the face check. Weaker results: #1 refill station, #5 sandbags away from the door.
- **Research rounds use low-competition long-tail keywords** (2026-10-31): 3-5 word phrases with 20-500 Adobe results, counted in the Claude app browser and logged in `research/keyword-competition.csv`. The band is the owner's choice and unproven against sales. Methods are named ต่อยอด, โครงสร้าง and รีเสิร์ช.
- **First real CLI batch** (2026-10-31): sesame-oil still life expanded into 10 full-scene oil images; 10/10 saved, one needed a QA retry. Exposed and fixed a cutout misclassification (`--layout` added).
- **Vercel fully removed** (2026-10-30): project `adobe-stock` and Blob store `adobe-stock-blob` were deleted by the owner; the old site returns 404. There is no longer a web fallback, though the code stays in git history before commit `79361d2`.
- **Dashboard and Vercel app removed** (2026-10-30): `npm run generate` replaces them. Images go to `~/Downloads/adobe/` and stay on that machine; prompt history moved from Vercel Blob to `history/prompt-history.json` in git. Email (SMTP2GO), login, Next.js, React and ESLint were removed with the web app.
- **Sold-image expansion handles cutouts** (2026-10-29): isolated elements expand into 10 isolated elements on pure white JPEG; full scenes expand into full scenes. Live-tested through the old dashboard: 10/10 passed QA. Weaker results were a rolled mossy log and a shapeless volcanic rock pile.
- **Research files are not tied to a date** (2026-10-29): the newest `research/manual-prompts-YYYY-MM-DD.md` is used. Format: `research/README.md`.

## Open / blocked

- The owner's email addresses remain in old git history of this public repo.
- `research/manual-prompts-2026-10-28.md` intro still says the prompts are "not added to the pipeline" (outdated wording).

## Next steps

1. Keep expanding sold images as they arrive.

## Gotchas

- OpenRouter balance updates minutes after a run, so same-run credit differences read near zero.
- Generated JPEGs are ~1376×768 (~1 MP), below Adobe Stock's 4 MP minimum. This is intentional: the owner upscales manually before uploading, so the app does not upscale.

- `npm test` compiles to `.test-dist/` then deletes it. The OpenRouter `TimeoutError` lines during tests are expected (simulated).
- Research briefs must be exactly 10, numbered 1–10, each with `- Category:` and ≥15 `- Keywords:`, or the batch is refused before any paid call.

## Setting up a new machine

Follow "ตั้งเครื่องใหม่" in `README.md`. Not in git: `.env.local` and generated images.
