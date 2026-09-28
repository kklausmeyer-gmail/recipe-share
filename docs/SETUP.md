# One-time setup (about 20 minutes)

Everything here is on free plans. You'll end up with:

- **Website:** `https://kklausmeyer-gmail.github.io/recipe-share/`, built and published by GitHub
- **Database, sign-in and photos:** a free Supabase project, locked to the people you invite

## 1. Make the repo public

GitHub Pages is free only for public repos. The repo holds only app code. Recipes, photos,
notes and ratings live in Supabase behind sign-in, and `import/` is git-ignored, so no photos get committed.

GitHub → **Settings → General → Danger Zone → Change visibility → Public**.

## 2. Create the Supabase project

1. Sign up at <https://supabase.com> and create a **New project** on the free plan, in a region near you.
   Save the database password somewhere safe. You won't need it day to day.
2. Open **SQL Editor → New query**, paste all of `supabase/migrations/0001_init.sql`, and click **Run**.
3. In another query, add the two owners. Use the email addresses you'll sign in with:

   ```sql
   insert into members (email, display_name, role) values
     ('you@example.com',   'Your name', 'owner'),
     ('jenny@example.com', 'Jenny',     'owner');
   ```

   To add more people later, use the app's **Settings** page.

## 3. Sign-in settings

1. **Authentication → URL Configuration**
   - Site URL: `https://kklausmeyer-gmail.github.io/recipe-share/`
   - Redirect URLs: add the same URL, plus `http://localhost:5173/recipe-share/` for local testing
2. **Authentication → Emails → Magic Link** template: add the code so the iPhone home-screen app
   can sign in. The link would open in Safari instead of the app. For example:

   ```html
   <h2>Sign in to Recipe Box</h2>
   <p><a href="{{ .ConfirmationURL }}">Tap here to sign in</a></p>
   <p>Or enter this code: <b>{{ .Token }}</b></p>
   ```

   Make the same change to the **Confirm signup** template. It's used the first time each person signs in.

Supabase's built-in email sender allows only a few emails an hour. That's fine here, because sign-ins last for months.

## 4. Keys

**Project Settings → API Keys**:

- **Publishable key** (`sb_publishable_…`, or the legacy `anon` key): this is safe to publish. Put it and the
  project URL in **`.env.production`** and commit it:

  ```
  VITE_SUPABASE_URL=https://abcdefgh.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  ```

- **Secret key** (`sb_secret_…`, or the legacy `service_role` key): **never commit this.** Put it in
  **`.env.local`** on the computer that runs the import. Copy `.env.example` and fill it in.

## 5. Deploy the link-import function

This small server function lets the app read recipe websites when you paste a link. On your computer, in this repo:

```sh
npx supabase login
npx supabase functions deploy import-url --project-ref <your-project-ref> --no-verify-jwt --use-api
```

The project ref is the `abcdefgh` part of your Supabase URL. `--no-verify-jwt` is safe here because the
function checks for itself that the caller is a signed-in member.

## 6. Turn on GitHub Pages

1. GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge the work into `main`. Every push to `main` builds and publishes the site. Watch progress under **Actions**.
3. The **Keep Supabase awake** workflow runs twice a week, because free Supabase projects pause after 7 idle days.
   It reads `.env.production`, so it needs no extra setup.

## 7. On your phones

Open the site in Safari, then tap **Share → Add to Home Screen**. Sign in with the **code** from the email.

## Local development (optional)

```sh
npm install
copy .env.example .env.local   # Windows (cp on Mac); then fill it in
npm run dev                  # http://localhost:5173/recipe-share/
```
