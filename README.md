# Hush

A focus instrument you hold.

[Live demo](https://jimmerioles.github.io/hush/) · [Case study](https://jimmerioles.github.io/hush/case-study.html)

https://github.com/user-attachments/assets/60dc4c72-28aa-426f-95ef-373d23f951a4

Hush is a one-screen prototype about attention. Eight notifications drift around a grainy orb. Hold `Space` and they spiral in, the static clears, and a twelve-second ring fills; let go early and the noise rushes back. It is a design study in making focus feel physical, not a productivity app.

## What it does

- Hold `Space`, `Enter`, or the keycap for twelve seconds to finish.
- Eight notification chips orbit on their own paths, get absorbed one by one, and respawn.
- A Canvas 2D orb built from procedural grain resolves into a mint glow as focus rises.
- A progress ring, absorption particles, ambient dust, and a bloom on completion.
- Copy shifts from "Stay with it" to "Almost quiet" to "Don't let go" before the page lands on "It's quiet now."
- A synthesized soundscape of drone, air, chimes, and a bloom chord. It starts only on your gesture, and the header has a mute toggle.
- Reduced motion, a phone layout with fewer chips, and a `?test` hook that steps the hold for captures.

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:5173 (case study: /case-study.html)
npm run build    # typecheck and build both pages
npm run preview  # preview the built site
```

Node 20 or newer. No environment variables or services.

## Use it

Hold `Space`, `Enter`, or the keycap. The ring takes twelve seconds. Release early and the noise returns; a full ring drains in about 1.2 seconds. Press `Go again` to reset. The header toggle mutes the audio and remembers the choice.

## Case study

The [case study](https://jimmerioles.github.io/hush/case-study.html) is a long-form page about the design, the twelve-second hold, the chip math, the audio graph, the film, and the current limits. It is a second Vite entry at `case-study.html`, built from the same source as the instrument.

## How it works

One number, `progress`, runs the page. It climbs at `1 / 12` per second while you hold and drains at `0.85` per second when you let go. The orb, chip orbits, ring, copy, and audio all read from it, so the interaction stays one instrument instead of a stack of effects.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the state machine, chip math, audio graph, and test hook.

The 3:14 hero film is built from real captures of this prototype. Read the [chapters, script, and rebuild notes](docs/explainer/README.md).

## Limits

- The twelve-second hold is a demo, not a session timer. There is no 25-minute mode yet.
- Notifications are staged in the page. Nothing connects to a real inbox or browser API.
- No accounts, sync, or settings beyond the mute preference.

## Tests

Tests: no automated suite yet. `npm run build` typechecks the instrument and the case study entry, and the `?test` hook steps the full arc on demand for screenshots and manual checks.

## Credits

Built by [Jim Merioles](https://github.com/jimmerioles). The interface, canvas art, synthesized audio, and film are original work. The film was made with [explainer-kit](https://github.com/jimmerioles/explainer-kit).

License: no public license yet, so the code and film are all rights reserved.
