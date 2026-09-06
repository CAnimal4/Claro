# Claro Spanish

Claro is a lightweight, dependency-free Spanish practice app built for short, focused study sessions. It runs as a static site and keeps practice progress in the learner’s browser.

## What’s included

- Spanish 1 practice for numbers, days, months, seasons, time, colors, and additional grammar and vocabulary modules.
- Spanish 2 Honors practice with:
  - **Ordinal Numbers** — English → Spanish translation, gender agreement, `primer`/`tercer`, and sentence context.
  - **Test 1 Review** — regular preterite and imperfect conjugation, past-tense time vocabulary, tense choice, and explicit Spanish → English verb translation.
- One-question-at-a-time practice with answer feedback, hints, keyboard shortcuts, hidden questions, and progress scoring.
- Optional premium access that expands practice depth and variety without paywalling the Honors curriculum.
- Responsive dashboard and practice layouts with saved level, module, settings, scores, and session history.

## Run locally

This is a static app. From the project directory, start any local static server:

```bash
python3 -m http.server 8765
```

Then open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) in a browser.

No package installation is required for the app itself.

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

## How the app works

`app.js` uses a data-driven module registry. Each module has a key, display name, level, and question generator. Question pools provide stable IDs so the app can support:

- hidden questions;
- recent-question avoidance;
- weak-question weighting;
- answer history and accepted variants;
- per-item scores and session analytics.

Spanish 1 modules remain level-filtered from Spanish 2 Honors modules. The dashboard and practice selector use the selected level when deciding which modules are visible and available.

## Persistence

Primary state is stored under:

```text
spanish_app_v2_state
```

The state includes settings, enabled modules, hidden items, item scores, answer history, profile information, session history, and lifetime statistics. The app also keeps compatibility with the legacy `spanishPracticeApp_v1` key and uses defensive migration when loading saved data.

Premium access is stored separately from normal practice state. No credentials or private access values belong in this repository.

## Answer matching

Answers are normalized for harmless differences such as capitalization, surrounding punctuation, spacing, and accents. Accepted-answer sets are still module-specific, so the app remains strict about grammar and meaning:

- ordinal gender and masculine singular shortening remain contextual;
- English translations can accept natural equivalents;
- Spanish 2 time expressions can accept appropriate wording variants;
- incorrect meanings are not accepted merely because formatting is similar.

## Keyboard shortcuts

When an answer field is not focused:

- `Space` — show a hint or reveal;
- `→` — reveal or continue;
- `N` — next question;
- `P` — mark a Numbers item for extra practice;
- `?` — toggle help;
- `Esc` — close the active modal.

When typing, `Enter` submits the answer, and after a correct answer it advances to the next question.

## Validation

Check JavaScript syntax with:

```bash
node --check app.js
```

The app also exposes an in-browser diagnostic command:

```js
runAutomatedChecks()
```

The Developer Checks section in Settings runs the same checks and reports a pass summary in the UI and console.

For rendered QA, verify the level switch, module toggles, practice entry, answer submission, modal controls, responsive layout, and browser console after starting the local server.

## Editing guidance

Keep new learning content data-driven and give every question a stable, unique ID. Preserve the existing state keys and module-level filtering. When changing visible behavior, validate both Spanish 1 and Spanish 2 Honors so a new module does not leak into the wrong dashboard.
