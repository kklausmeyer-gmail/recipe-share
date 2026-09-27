# Recipe Share

A private family recipe box. It's a static React app on GitHub Pages, with Supabase handling
sign-in, the Postgres database (with row-level security) and private photo storage. It costs nothing to host.

- `src/`: Vite + React + TypeScript + Tailwind app. It uses HashRouter because GitHub Pages has no SPA fallback.
  - `lib/store.tsx` loads the whole recipe box into memory, so search and filtering run client-side.
  - `lib/photos.ts` handles signed URLs (batched and cached), in-browser resizing and uploads.
  - `lib/suggest.ts` scores meal-plan suggestions. `lib/ingredients.ts` parses, scales and builds grocery lists.
- `supabase/migrations/`: the schema, row-level security and starter tags. Owners get meal planning;
  editors can edit recipes, rate them and log cooks.
- `supabase/functions/import-url/`: an Edge Function that fetches recipe pages and images for the app.
  `_shared/recipe-parse.ts` is also used by the Node scripts.
- `scripts/`: one-time import and transcription-queue tools, run locally with `.env.local`.
- Docs: `docs/SETUP.md` (accounts and deploy) and `docs/IMPORT.md` (the photo and link import, which includes
  the transcription rules to follow).

Rules:
- The repo is public. Never commit anything under `import/`, `.env.local`, secret keys or recipe photos.
- Ingredients and steps are stored as arrays of plain-text lines. A line starting with `# ` is a section header.
- Checks: `npm run typecheck` and `npm run build`.
