# Claro Spanish

Go straight to the live app: **[clarospanish.vercel.app](https://clarospanish.vercel.app)**.

Claro is a browser-based Spanish learning application designed for focused practice, repeatable study habits, and gradual expansion into new course levels and learning activities. The live product is deployed through Vercel, while the repository contains the static frontend that Vercel serves.

## Overview

Claro is intentionally simple to run and easy to extend. It does not require a backend for normal practice: the interface, learning content, question generation, scoring, and browser persistence are handled by the frontend. A learner can open the public Vercel URL and begin practicing immediately.

The app is designed around a few principles:

- short sessions instead of overwhelming study screens;
- clear prompts and immediate feedback;
- content organized by course level and topic;
- flexible answer matching without ignoring grammar;
- local progress that remains available in the same browser;
- a data-driven structure that makes new modules easier to add.

## Learning experience

Claro supports multiple levels, modules, and question styles while keeping the core interaction consistent. Current content includes foundational Spanish practice and Spanish 2 Honors work covering vocabulary, conjugation, tense selection, ordinal numbers, translation, and sentence context.

Practice includes one-question-at-a-time feedback, hints, keyboard shortcuts, hidden questions, weak-question rotation, score tracking, and session history. Optional premium access expands depth and variety where enabled; it does not replace the underlying curriculum or make core learning content inaccessible.

## Live deployment

The public site is hosted on [Vercel](https://vercel.com/) at [clarospanish.vercel.app](https://clarospanish.vercel.app). Vercel provides the public HTTPS URL and serves the static frontend files from the deployed project. The app itself does not depend on Vercel-specific runtime code for ordinary practice, which keeps local development straightforward and makes the frontend portable.

When the project is connected to Vercel, a new deployment can publish updated versions of the static files. After deployment, verify the live URL separately from local checks: confirm the expected version is served, load the dashboard, switch levels, enter practice, and exercise the changed interaction in a real browser.

## Run locally

This is a static app. From the project directory, start any local static server:

```bash
python3 -m http.server 8765
```

Then open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) in a browser.

No package installation is required for the app itself. Local serving is useful for development and validation; it does not change the live Vercel deployment.

## Project structure

```text
.
├── index.html              # App shell, dashboard, settings, and modal markup
├── app.js                  # State, module pools, question generation, scoring, and interactions
├── style.css               # Visual system and responsive layout
├── assets/                 # Brand assets and Spanish 2 study materials
├── manifest.webmanifest    # Installable web-app metadata
└── README.md               # Project documentation
```

## Architecture

The application is a static frontend with three primary layers:

- `index.html` provides the semantic app shell, dashboard, settings, practice surface, and dialogs;
- `style.css` provides the visual system, responsive layout, and interaction states;
- `app.js` contains application state, module definitions, question pools, generators, answer checking, persistence, and UI behavior.

`app.js` uses a data-driven module registry. Each module has a key, display name, level, and question generator. Question pools provide stable IDs so the app can support:

- hidden questions;
- recent-question avoidance;
- weak-question weighting;
- answer history and accepted variants;
- per-item scores and session analytics.

Spanish 1 modules remain level-filtered from Spanish 2 Honors modules. The dashboard and practice selector use the selected level when deciding which modules are visible and available.

## Browser data and privacy

Primary state is stored under:

```text
spanish_app_v2_state
```

The state includes settings, enabled modules, hidden items, item scores, answer history, profile information, session history, and lifetime statistics. The app also keeps compatibility with the legacy `spanishPracticeApp_v1` key and uses defensive migration when loading saved data.

Premium access is stored separately from normal practice state. Normal practice data is local to the learner’s browser unless a future integration explicitly adds another service. Clearing browser storage, changing browsers, or using a different device can remove or separate local progress. No credentials or private access values belong in this repository.

## Content and answer matching

Answers are normalized for harmless differences such as capitalization, surrounding punctuation, spacing, and accents. Accepted-answer sets are still module-specific, so the app remains strict about grammar and meaning:

- ordinal gender and masculine singular shortening remain contextual;
- English translations can accept natural equivalents;
- Spanish 2 time expressions can accept appropriate wording variants;
- incorrect meanings are not accepted merely because formatting is similar.

## Interaction conventions

When an answer field is not focused:

- `Space` — show a hint or reveal;
- `→` — reveal or continue;
- `N` — next question;
- `P` — mark a Numbers item for extra practice;
- `?` — toggle help;
- `Esc` — close the active modal.

When typing, `Enter` submits the answer, and after a correct answer it advances to the next question.

## Development and validation

Check JavaScript syntax with:

```bash
node --check app.js
```

The app also exposes an in-browser diagnostic command:

```js
runAutomatedChecks()
```

The Developer Checks section in Settings runs the same checks and reports a pass summary in the UI and console.

For rendered QA, verify the level switch, module toggles, practice entry, answer submission, modal controls, responsive layout, and browser console after starting the local server. For a release intended for the public site, repeat the important checks against [clarospanish.vercel.app](https://clarospanish.vercel.app) after Vercel finishes deploying.

## Contributing and extending

Keep new learning content data-driven and give every question a stable, unique ID. Preserve the existing state keys, level filtering, answer conventions, and keyboard behavior. New modules should fit the existing dashboard and practice flow rather than introducing a separate interaction model.

Before publishing a meaningful change:

1. Check the source for syntax errors.
2. Run the in-app Developer Checks.
3. Test the changed flow locally in a browser.
4. Confirm that unrelated levels and modules still work.
5. Verify the deployed result at the Vercel URL.
