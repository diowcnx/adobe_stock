# Adobe Stock image generator

Command-line tool that turns one sold image, a research file, or the structure catalog into 10 Adobe Stock JPEGs plus `metadata.csv`. Any agent on any machine runs it from this repo; git carries the code, research and prompt history.

## Generating images

The owner sends a sold image and asks for 10 new images, or asks for a daily or research batch.

1. `git pull`, then `npm install` if `node_modules` is missing.
2. Check `.env.local` holds `OPENROUTER_API_KEY`. If it is absent, ask the owner to create it from `.env.example`; keys are entered by the owner.
3. Plan: `npm run generate -- sold <image-path> --plan` (or `daily`, `research`). Planning writes a batch folder and lists the briefs.
4. Show the owner the briefs, the balance (`npm run generate -- credits`) and the estimate of about $0.04 per image (up to 4 attempts each). Wait for a yes; generation spends real money.
5. `npm run generate -- resume "<folder>"`. It finishes when it prints `Folder:` and `Credit:`.
6. Rerun `resume` for any `Failed` line; it generates only missing images.
7. Report saved count, `QA warning` lines, spend and the folder. View the images and name weak ones.
8. Commit and push `history/`, so other machines avoid repeating these prompts.

Done means every planned image is saved or reported as failed, and `history/` is pushed.

## Images

Images and `metadata.csv` go to `~/Downloads/adobe/<batch>/` on the machine that made them and stay out of git, because this repo is public. The owner upscales them to Adobe's 4 MP minimum, uploads, then deletes them, so the app never upscales.

## Sold images

A sale proves one buyer for one asset, not market demand. New images must be original work, never copies of the source. Cutouts (isolated element on white) expand into cutouts on pure white; full scenes expand into full scenes. The analyzer picks the layout; check `Layout:` in the output matches the image.

## Changing the code

Run `npm test` and `npm run typecheck` before committing. Tests mock OpenRouter; the `TimeoutError` lines are simulated. `docs/STATUS.md` holds current state and open items.

New research rounds: follow `research/README.md`.
