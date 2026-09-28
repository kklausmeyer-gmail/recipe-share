# Recipe Share: Plan

A private, ad-free, photo-first recipe box for our family and anyone we invite.
Hosting costs nothing per month.

## Goals

- Every recipe from the shared Google Photos album and the Google Doc of links, in one searchable place
- A photo-first grid: each card shows the finished dish (our photo if we have one, otherwise the recipe's photo)
- Search by keyword or ingredient, and filter by tags (gluten free, dairy free, paleo, dinner, breakfast, ...)
- Cook mode: large text, screen stays awake, tap to check off ingredients and steps
- A log of each time we cook a recipe, with the date, a star rating, notes on changes, and photos of the dish
- The original recipe image or link is always one tap away
- A meal plan that shows past dinners and suggests meals for the coming week
- Only invited people can sign in

## Architecture (no monthly cost)

| Piece | Service | Free-tier limits |
|---|---|---|
| Code | GitHub repo | - |
| Website | GitHub Pages, deployed by a GitHub Action | Pages needs a **public** repo on a free account (see Open questions) |
| Sign-in | Supabase Auth, emailed link or code; a database trigger rejects emails not on the invite list | 50k monthly users |
| Database | Supabase Postgres with row-level security | 500 MB |
| Photos | Supabase Storage in a private bucket, served through signed URLs | 1 GB |
| Link import | Supabase Edge Function that fetches a recipe URL and reads its schema.org JSON-LD | 500k calls per month |
| Keep-alive | A weekly GitHub Action ping, because Supabase pauses a free project after 7 idle days | - |

The website contains no recipe data. All data sits behind Supabase sign-in and
row-level security, so a public repo or a public site URL exposes only the app code.

**iPhone:** the site is a Progressive Web App. Use Safari's "Add to Home Screen" and it
opens full-screen like an app. A native App Store app would cost $99 a year, so we won't build one.

**Photo budget:** before upload, each photo is resized to a 1600px copy (about 250 KB)
and a 400px thumbnail (about 30 KB). That fits about 3,000 to 3,500 recipe and dish
photos in 1 GB. Full-size originals stay in Google Photos.

## Data model

- `recipes`: title, description, servings, prep/cook time, ingredients (JSON:
  quantity, unit, item, note), steps (JSON), source_type (photo | link | manual),
  source_url, tags[], hero_photo_id, and a full-text search column
- `recipe_photos`: recipe_id, kind (original_scan | dish | web_image), storage paths, sort order
- `cook_log`: recipe_id, cooked_on, cooked_by, meal (dinner, lunch, ...), rating (1 to 5), notes, photo ids
- `recipe_notes`: running notes and ingredient substitutions per recipe
- `meal_plan`: date, meal, recipe_id, status (planned | cooked | skipped)
- `tags`: a curated list with color and group (diet, meal, cuisine, protein)
- `members`: the invite allow-list

A recipe's rating is the average of its cook-log ratings. The card also shows the
most recent rating.

## Screens

1. **Browse:** a photo grid with a search bar, tag chips, and sorting by rating,
   last cooked, newest, or least recently made
2. **Recipe:** hero photo, ingredients (servings scaler), steps, tags, our notes, cook
   history, a gallery of our dish photos, and "View original" (full-screen zoomable scan, or the source link)
3. **Cook mode:** one step at a time, large type, and the Wake Lock API keeps the screen on
4. **Log a cook:** date, stars, notes on what we changed, and photos taken with the phone camera
5. **Add recipe:** paste a URL (auto-imports), upload a photo, or type it in
6. **Meal plan:** this week plus 3 to 4 weeks of history, with a "Suggest my week" button
7. **Settings:** invite people, manage tags

## Meal suggestions

Each candidate recipe gets a score:

- a higher rating raises the score
- a longer time since it was last made raises the score (so old favorites come back)
- a protein or cuisine already in this week's plan lowers the score, for variety
- recipes that are already planned are excluded, and tag filters apply (for example "dinner only, gluten free")
- a small random jitter makes "Shuffle" give different results

You can lock suggestions you like and re-roll the rest.

## Import pipeline (run once, with Claude Code on the home computer)

1. **Photos:** download the Google Photos album into a folder (select all, then
   Download, or use Google Takeout). The Google Photos API no longer lets apps read
   albums they didn't create, so the download has to be done by hand.
2. **Transcription:** Claude Code reads each image and writes `import/recipes/<slug>.json`
   (title, structured ingredients, steps, servings, times, suggested tags). Where a
   recipe spans several photos, the photos are grouped into one recipe. Photos of
   finished dishes are attached as dish photos.
3. **Review:** a quick pass over a generated contact sheet to fix grouping or OCR mistakes.
4. **Links:** export the Google Doc as `.txt`. A script pulls out every URL, fetches it,
   reads the schema.org Recipe JSON-LD, and downloads the site's photo. Failed URLs go to
   a list for manual handling.
5. **Upload:** a script resizes the images, then writes them to Supabase Storage and the database.
   Images are never committed to git.

## Adding recipes later

- **By link:** paste a URL in the app. An Edge Function parses it and shows a pre-filled form.
- **By photo:** upload one or more photos, and the recipe is saved as "needs transcription".
  It is transcribed in one of two ways (see Open questions):
  - (a) Run Claude Code on the queue now and then. This is free.
  - (b) Call the Claude API automatically. This costs about 1 to 2 cents per recipe, so it isn't strictly zero-cost.

## Tech stack

Vite, React, TypeScript, Tailwind, and supabase-js, deployed to GitHub Pages
by a GitHub Action. Node scripts in `scripts/` handle the import.

## Build order

1. Scaffold the app, set up the Supabase schema and row-level security, deploy, and sign in with a magic link
2. Browse grid, recipe page, search, and tags
3. Import scripts for photos and links, then load the real data
4. Cook log, ratings, notes, and dish photos
5. Cook mode
6. Add by URL or photo
7. Meal plan and suggestions
8. PWA polish: icon and offline cache of recently viewed recipes

## Decisions (Sep 27)

- **Hosting:** the repo will be public and the site runs on GitHub Pages. All data sits behind Supabase sign-in and row-level security.
- **Roles:** owners (the two of us) get everything, including the meal plan, grocery list and invites. Invited editors can add, edit, rate and log cooks.
- **Ratings:** each person keeps their own. Cards show the average, and the recipe page shows each person's rating.
- **Scale:** 254 album photos and about 25 links, well within the free tier.
- **Photos:** mostly cookbook pages, often across several pages, with the dish photo on page 2. The import groups the pages and crops the dish photo out of its page to use as the cover.
- **Grocery list:** combines the week's planned dinners into one list. AnyList has no public API, so the app offers Copy and Share, and the list pastes into AnyList one item per line.
- **New photo recipes:** they go to a free "needs typing up" queue, which Claude Code transcribes (`npm run queue:pull` / `queue:push`).
