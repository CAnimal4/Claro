# Claro Spanish

Claro is a browser based Spanish learning app deployed through Vercel. Students select Spanish 1A, Spanish 1B, or Spanish 2 Honors. The existing Spanish 1 catalog and browser progress belong to Spanish 1B; Spanish 1A starts with an empty class space for the pilot teacher’s materials. Spanish 2 Honors keeps its existing content and browser data.

## Student experience

Students stay anonymous. Practice progress, class selection, study preferences, notifications, and notification history are stored on the current browser/device. Modules and Settings are separate. Students can choose a study activity (standard, flashcards, Type It, multiple choice, or Mix), choose Standard/Easy/Hard difficulty, customize Home density and accent color, choose whether progress/history appear, replay the tour, and request modules for the selected class. First name and email are optional on module requests. A selected email receives a private status link only when an email sender is configured.

## Teacher and admin dashboards

The path routes `/teacher` and `/admin` serve their static dashboards. Teachers sign in individually and see only assigned classes. Admins invite teachers and assign classes. Student requests wait for the assigned teacher’s approval before admin workflow stages: Requested → In Review → Approved → Created → Tested → Published. Teachers may request modules directly or submit a bulk curriculum outline.

## Backend setup (required for dashboards and requests)

Create a Supabase project, run [`api/schema.sql`](api/schema.sql) in its SQL editor, and add these Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server side only; never expose it in frontend configuration)
- `CLARO_BOOTSTRAP_ADMIN_EMAIL` (the first authenticated user with this email becomes the initial admin)

For teacher invitations, configure Supabase Auth SMTP with a verified sender (Resend can provide this SMTP connection). For request receipts and teacher alerts, add `RESEND_API_KEY`, `CLARO_FROM_EMAIL`, and `CLARO_PUBLIC_URL` to Vercel. Without these provider settings, the local student app and dashboard screens can still be reviewed, but accounts, requests, and email workflows cannot run end to end.

After creating the first Supabase Auth user with the bootstrap email, sign in at `/admin`; the server creates the initial admin profile only if there is no admin yet. The admin dashboard can then invite teachers and assign their classes. Keep service-role and Resend secrets in Vercel environment settings only.

## Extensible module content

`api/claro/modules.js` accepts module definitions with a stable module slug and stable item IDs. Each item includes `prompt`, `answer`, optional `acceptedAnswers`, `choices`, `correctIndex`, `hint`, `explanation`, and optional `difficulty` (`easy`, `standard`, or `hard`). `api/schema.sql` stores the content as versioned JSON. The student runtime adapts published items to the shared flashcard, typing, multiple choice, and mixed activities. The admin module API creates drafts; admin publishing makes them available to the assigned class.

## Tally Feedback

The in-app Feedback button opens the existing Tally form at `https://tally.so/r/68grLO` with Feature Request, Module Request, and Report Bug categories. The existing Tally submissions are retained. Module workflow submissions use Claro’s API, not Feedback.

## Local review

From this directory, run `python3 -m http.server 8765` and open `http://127.0.0.1:8765/`. Static practice can be reviewed without provider credentials. The Vercel routes and server APIs require a configured deployment for end-to-end account/request/email behavior.
