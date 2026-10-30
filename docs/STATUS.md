# Project status

_Last updated: 2026-10-29_

## What this is

Command-line tool that generates 10 Adobe Stock JPEGs plus `metadata.csv` through OpenRouter. There is no website, dashboard, email or cloud storage. See `AGENTS.md` for how to run it.

## Done recently

- **Vercel fully removed** (2026-10-30): project `adobe-stock` and Blob store `adobe-stock-blob` were deleted by the owner; the old site returns 404. There is no longer a web fallback, though the code stays in git history before commit `79361d2`.
- **Dashboard and Vercel app removed** (2026-10-30): `npm run generate` replaces them. Images go to `~/Downloads/adobe/` and stay on that machine; prompt history moved from Vercel Blob to `history/prompt-history.json` in git. Email (SMTP2GO), login, Next.js, React and ESLint were removed with the web app.
- **Sold-image expansion handles cutouts** (2026-10-29): isolated elements expand into 10 isolated elements on pure white JPEG; full scenes expand into full scenes. Live-tested through the old dashboard: 10/10 passed QA. Weaker results were a rolled mossy log and a shapeless volcanic rock pile.
- **Research files are not tied to a date** (2026-10-29): the newest `research/manual-prompts-YYYY-MM-DD.md` is used. Format: `research/README.md`.

## Open / blocked

- The CLI has planned a real `sold` batch (key and `credits` work on the main machine) but has not generated a real image. The owner chose to wait for the next sold image as the first real run.
- The owner's email addresses remain in old git history of this public repo.
- `output/php-stock-study-2026-10-28/` still holds a test image in git.
- `research/manual-prompts-2026-10-28.md` intro still says the prompts are "not added to the pipeline" (outdated wording).

## Next steps

1. Run the next sold image as the first real batch.

## Gotchas

- Generated JPEGs are ~1376×768 (~1 MP), below Adobe Stock's 4 MP minimum. This is intentional: the owner upscales manually before uploading, so the app does not upscale.

- `npm test` compiles to `.test-dist/` then deletes it. The OpenRouter `TimeoutError` lines during tests are expected (simulated).
- Research briefs must be exactly 10, numbered 1–10, each with `- Category:` and ≥15 `- Keywords:`, or the batch is refused before any paid call.

## Setting up a new machine

Follow "ตั้งเครื่องใหม่" in `README.md`. Not in git: `.env.local` and generated images.
