# DigiRef Live Sync Preview

A mobile-first football officiating and game-administration pilot with live cross-device state synchronization, crew workflows, source-backed rule references, and local video evidence review.

## Why this project exists

Football crews manage clocks, score, possession, field position, flags, enforcement choices, corrections, and postgame reporting under time pressure. DigiRef explores how one interface can reduce administrative work while preserving the referee's judgment and a reviewable audit trail.

This repository is a public preview build. It is suitable for product demonstrations and controlled testing; it is not a certified rules authority or a replacement for trained officials.

## Features

- Referee, scorekeeper, and reports workspaces
- Game clock, play clock, score, timeouts, possession, down, distance, and field position
- Timestamped flags with official, team, player, play phase, and notes
- Human-confirmed enforcement worksheet and yardage calculator
- NCAA and NFHS reference catalogs with visible coverage limitations
- Short session codes for cross-device game-state synchronization
- Local-first game state with reconnection and revision checks
- Browser camera capture, review markers, local IndexedDB evidence storage, and SHA-256 checksums
- Evaluator history and exportable pilot reports
- Responsive phone/tablet layouts and installable web-app manifest

## Architecture

```text
Referee phone -----------+
                         |  Supabase Realtime / PostgreSQL row
Scorekeeper laptop ------+  shared revisioned game document

Each device also keeps local state and can continue without shared video.
Video evidence remains in the browser unless the operator explicitly exports it.
```

The browser uses a public Supabase publishable key. That key identifies the project but is not a secret; database authorization must be enforced through row-level security. Privileged service-role credentials must never be included in this client build.

## Technical highlights

- Revision-based conflict protection prevents stale tabs from silently overwriting newer state.
- Realtime subscriptions propagate score, clock, spot, and flag changes between paired devices.
- IndexedDB stores recordings, markers, and evaluator revisions locally.
- Evidence reports bind review markers to browser-monotonic timing and include integrity checks.
- Rule coverage and enforcement warnings make unsupported behavior visible rather than presenting it as authoritative.

## Run locally

The application uses browser modules, camera APIs, IndexedDB, and service-worker/PWA behavior. Serve it over localhost instead of opening `index.html` directly.

```powershell
python -m http.server 8000
```

Open `http://localhost:8000`.

Camera access generally requires localhost or HTTPS. Cross-device synchronization also requires network access to the configured Supabase project.

## Important limitations

- NFHS support in this build includes a clock guide and manual reporting vocabulary, not a fully validated current rulebook and casebook implementation.
- Complex foul enforcement requires referee review and confirmation.
- Live synchronization is a pilot architecture and should receive further authorization, isolation, load, reconnect, and concurrent-edit testing before public use.
- Camera tools record and organize evidence; they do not automatically detect fouls.
- Browser and application tests do not establish officiating accuracy.
- Real-device field testing, accessibility review, and independent official validation remain necessary.

## Privacy and safety

- Game data begins locally.
- Recordings stay in the device browser unless explicitly exported.
- Do not record minors or spectators without the permissions required by the venue, league, and applicable law.
- Do not store athlete identities, precise locations, or contact information in test feedback.

## Portfolio context

This preview demonstrates state-machine design, local-first browser storage, realtime synchronization, conflict handling, responsive product design, evidence workflows, and careful human-in-the-loop boundaries in a high-consequence domain.

