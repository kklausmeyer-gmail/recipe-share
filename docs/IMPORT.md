# Importing the Google Photos album and the Google Doc of links

This is a one-time job, run on your home computer with Claude Code. Nothing in `import/`
is committed: the folder is git-ignored, so photos never land in the public repo.

## What you do

1. **Finish [SETUP.md](SETUP.md) first**, including `.env.local` with the secret key.
2. `npm install`
3. **Download the album.** Open it in Google Photos, select all, then **⋮ → Download**. Unzip the
   photos into `import/photos/`. The Google Photos API no longer lets apps read shared albums, so this
   step has to be done by hand.
4. **iPhone photos are often HEIC.** Convert them to JPEG, because neither the scripts nor Claude can read HEIC.
   On a Mac:
   ```sh
   cd import/photos && mkdir -p ../heic && for f in *.HEIC *.heic; do [ -e "$f" ] && sips -s format jpeg "$f" --out "${f%.*}.jpg" >/dev/null && mv "$f" ../heic/; done
   ```
5. **Export the links doc.** In Google Docs, choose **File → Download → Web page (.html, zipped)**, then unzip it
   into `import/links/`. (A plain-text download works too if the doc shows the full URLs.)
6. Start Claude Code in this folder and say:
   > Follow docs/IMPORT.md and import our recipes.
7. When Claude is done, open **`import/review.html`** in your browser. It shows every recipe with its pages,
   the cropped dish photo, and any photos no recipe uses. Tell Claude what to fix.
8. Claude runs the upload. Open the site and enjoy.

## What Claude Code does

### A. Links

```sh
npm run import:links -- import/links/<exported file>.html
```

This writes `import/recipes/link-*.json` for each recipe page. Then open `import/link-failures.txt`.
For each blocked or partial link, fetch the page yourself (WebFetch). If there's still no recipe
text, write the JSON by hand from what you can read, and keep `source_url` so the link is always one tap away.
Review the tags on each link recipe (see the tag rules below).

### B. Photos: transcribe each recipe into `import/recipes/<slug>.json`

Work through `import/photos/` in filename order, in batches of about 15 images. That order is roughly
the order they were taken, so a recipe's pages are usually next to each other. When a batch
ends in the middle of a recipe, carry that recipe into the next batch. If context gets
large, give each batch to a subagent and tell it to write only its own JSON files.

For every photo, decide what it is:

- **A recipe page:** add it to that recipe's `pages`, in reading order. A recipe continues onto the
  next photo when that photo starts mid-list or mid-step, says "continued", or has no title of its own.
- **A page that is mostly the finished-dish photo** (in cookbooks this is often the facing page, or
  "page 2"): add it to that recipe's `dish_crops` with a crop that frames only the food, leaving out the
  text and page edges. If the whole photo is the food, use `dish_photos` instead.
- **A recipe page that also has a dish picture on it:** list it in `pages` **and** add a `dish_crops`
  entry for the picture.
- **Two recipes on one page:** make two recipe files that both list the page.
- **Our own photo of food we made:** use `our_photos`.
- **Not a recipe at all:** list it in `import/skipped.txt` with a reason.

Crop boxes are fractions of the upright image: `x` and `y` are the top-left corner, and `w` and `h` are the width
and height, all between 0 and 1. Check a crop in `review.html`. It's fine to trim a little into the
food, but not to include text.

**Transcription rules**

- Copy the recipe faithfully. Keep quantities and units as printed ("1½ cups", "2 Tbsp").
- `ingredients`: one line per ingredient. Section headings become lines starting with `# `
  (for example `"# For the dressing"`).
- `steps`: one entry per step or paragraph, without the step numbers.
- `description`: one or two sentences summarizing the headnote, or `null`.
- Add `servings`, `prep_minutes`, `cook_minutes` and `total_minutes` when they're printed.
- `source_book`: the cookbook's title, if a running header, footer or the style tells you. `source_page` is the printed page number.
- Handwritten notes in the margins go in `notes` (for example `"Use half the chili flakes"`).
- If a page is too blurry or cut off to read, transcribe what you can and add a note saying so.

**Tag rules.** Use lowercase names from this list, and only when they're clearly true:

- meal: breakfast, lunch, dinner, side, dessert, snack, drink, sauce
- diet: gluten free, dairy free, paleo, vegetarian, vegan. Judge by the ingredients, and be conservative:
  flour, pasta, bread, soy sauce, beer or regular oats mean not gluten free, and butter, cream,
  cheese, yogurt or milk mean not dairy free. A recipe is paleo only with no grains, legumes, dairy or refined sugar.
- protein: chicken, beef, pork, fish, shrimp, turkey, lamb, beans, tofu, eggs
- cuisine: italian, mexican, asian, indian, mediterranean, american
- other: quick (≤ 30 minutes total), slow cooker, instant pot, grill, soup, salad, make ahead

Most main dishes should get `dinner`, because the meal planner suggests from dinner recipes.

**File format**

```json
{
  "title": "Sheet-Pan Chicken with Lemon and Olives",
  "description": "Crispy-skinned thighs roasted on one pan with lemon, olives and herbs.",
  "servings": "4",
  "prep_minutes": 15,
  "cook_minutes": 40,
  "total_minutes": null,
  "ingredients": [
    "2 lb bone-in, skin-on chicken thighs",
    "1 lemon, thinly sliced",
    "# For the sauce",
    "3 Tbsp olive oil"
  ],
  "steps": [
    "Heat the oven to 425°F.",
    "Toss the chicken with the lemon, olives and oil, then roast until golden, about 40 minutes."
  ],
  "tags": ["dinner", "chicken", "gluten free", "dairy free", "mediterranean"],
  "source_type": "photo",
  "source_book": "Dinner in One",
  "source_page": "112",
  "pages": ["IMG_4021.jpg", "IMG_4022.jpg"],
  "dish_crops": [{ "file": "IMG_4022.jpg", "x": 0.06, "y": 0.08, "w": 0.88, "h": 0.55 }],
  "dish_photos": [],
  "our_photos": [],
  "notes": ["We use boneless thighs, 30 min"]
}
```

Name each file after the title (`sheet-pan-chicken-with-lemon-and-olives.json`).

### C. Review, then upload

```sh
npm run import:review                  # writes import/review.html, lists unused photos and warnings
npm run import:upload -- --dry-run     # checks every file
npm run import:upload                  # uploads; safe to re-run, skips finished ones
```

Before uploading, every photo should be used by a recipe or listed in `import/skipped.txt`.

## Later: recipes added in the app as photos

When someone adds a recipe in the app with **From photos**, it's saved as "Needs typing up". To transcribe the queue:

```sh
npm run queue:pull     # downloads the pages to import/queue/<id>/ with a recipe.json to fill in
```

Fill in each `import/queue/<id>/recipe.json` using the rules above. `dish_crops` refer to the `page-N.jpg`
files in that folder. Then run:

```sh
npm run queue:push     # uploads them and marks the recipes ready
```
