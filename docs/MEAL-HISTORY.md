# Private meal-plan history

The planner accepts a recipe or a free-text dinner. Free-text meals and original
schedule context are stored only in `meal_plan`, under its owner-only row-level
security policy. They are never written into recipes or the shared cooking log.
Only the two intended collaborators should have the owner role.

## Importing an Apple Notes Markdown export

Run a preview locally, supplying the year of the newest dated table:

```powershell
node node_modules/tsx/dist/cli.mjs scripts/import-meal-history.ts '<export.md>' 2026
```

The review and generated rows go under ignored `import/meal-history/`.
The parser handles multiline table cells and infers year transitions from month
rollovers in the newest-first note. Within a week, dates may advance across New
Year's Day. Written month/day takes precedence over inconsistent weekdays;
warnings and undated trailing text are preserved in `review.json`.

To import using the local Supabase credentials:

```powershell
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/import-meal-history.ts '<export.md>' 2026 --apply
```

The importer checks for two owner accounts and anonymous access, leaves existing
plans untouched, and uses deterministic IDs so identical entries are not imported
twice. Conflicts with existing plans go to `conflicts.json`. Different original
notes on the same date are preserved. Imported rows are **planned**, not confirmed
as cooked. The anonymous check does not verify the live policy for editor accounts;
the deployed database must retain the owner-only policy in `0001_init.sql`.

## Suggestions

Recognizable dinner text is extracted conservatively from past labels. Repeated
meals on the same weekday rank higher. Automatic suggestions can fill up to half
of the available nights with these usual dinners, mixed with recipe suggestions.
Exact meals used within six days and duplicate labels in the current week are
excluded. These are suggestions based on past plans, not confirmed cooking history.
Diet filters disable automatic free-text suggestions because their ingredients
are unknown. Free-text dinners are also listed separately on the grocery screen,
since ingredients cannot be inferred safely.

No future recurring events are inferred from old schedule notes.

## Calendar events and two-week planning

Apply `supabase/migrations/0002_calendar_events.sql` in the Supabase SQL editor
before saving calendar events. This creates an owner-only table with row-level
security, explicitly denies anonymous access, and validates event date/time ranges.
Run `supabase/tests/calendar_events.sql` afterward to verify owner access and editor
and anonymous restrictions; its temporary fixtures are rolled back.

Use **Add calendar event** for a title, start date (defaults to today), recurrence
(defaults to weekly), optional inclusive end date, optional start/end times, and
notes. Weekly occurrences follow the start date's weekday. Times are local wall
times and do not shift across daylight-saving changes. Click an indigo event on a
day to edit the series, or use **Manage events** to find events outside the visible
weeks. Editing changes the entire series; per-occurrence exceptions are not yet
supported. Delete requires a second confirmation in the form.

**Show next week** expands the calendar to fourteen days. Suggestions and grocery
links follow the visible range. Suggestions preserve confirmed plans, cooked or
skipped entries, and dates outside the visible range. Both weeks' existing plans
are fetched before the suggestion button is enabled.

Additional checks: `node node_modules/tsx/dist/cli.mjs scripts/calendar.test.ts`.

## Dishes and day notes

Each dinner can contain several `meal_plan` rows. **Add another dish** appends a
recipe or free-text dish; **Edit** and **Remove** affect only the selected dish.
The recipe detail page also appends dishes. Grocery lists include all selected
recipes on each date. Re-rolling an individual suggestion preserves other dishes.

Use **Add dinner or notes** (or **Add dish or notes** on a populated day) for
simple meals, day notes, or a combination. These are stored as free-text labels
under the meal plan's owner-only policy. Edit a free-text entry to change the
meal or notes; additional recipes remain separate rows.

The separate day-notes control has been removed. Migration `0003` and its tests
remain as historical records of the previously applied database change; the app
no longer reads or writes that table. Existing rows are retained in the database.

## iPhone home-screen app

The live HTTPS site already provides standalone display metadata, a web app
manifest, and Apple touch icons. In iPhone Safari, use **Share → Add to Home
Screen**, enable **Open as Web App** if offered, then choose **Add**. If the
action is hidden, add it via **Edit Actions** in the share sheet. Launch from the
icon and sign in with your email and password inside the app. Set a password in
Settings while already signed in. No email-template changes are required. The local computer preview cannot be installed on the phone
using its loopback URL. New local UI changes appear on the phone after deployment.
This app needs internet access for private data; it does not cache schedules for
offline use. Settings includes the live site link and the installation steps.

Checks: `node node_modules/tsx/dist/cli.mjs scripts/meal-history.test.ts`,
`npm run typecheck`, and `npm run build`.

## Password sign-in

Login defaults to email and password using Supabase Auth's `signInWithPassword`.
Signed-in members can set or change their own password in Settings using
`updateUser`; passwords are never written into public application tables or
stored separately by this app. Existing membership checks and owner-only policies
continue to govern data access. There is no new registration form.

For a first-time password or a forgotten one, use the existing email-link login,
open the link in a browser, and set a password in Settings. Then return to the
home-screen app and sign in with email and password. Each collaborator completes
their own setup. The email-code template remains unconfigured because of the
hosted email restriction documented under `supabase/templates/README.md`.

The password form enforces a matching confirmation and at least eight characters;
Supabase may impose additional requirements, which are shown on failure. An
optional current-password field supports server policies that require it. If
Supabase requires a recent sign-in, use a fresh email link and retry setup.
