# Architecture

Hush is a static Vite page with no framework, backend, or runtime media assets. This document covers the parts that are easy to lose in the main README: the state machine, rendering, chip math, audio graph, and test hook.

## Files

| File | Role |
| --- | --- |
| `index.html` | Static shell: headline, stage, keycap, readout, footer |
| `src/main.ts` | State machine, canvas scene, chip physics, particles, input |
| `src/audio.ts` | Web Audio graph and synthesized cues |
| `src/style.css` | Layout, keycap, chips, responsive rules |
| `docs/explainer/` | Script, scenes, captures, score, poster, rebuild notes |

## State machine

The app has three phases: `idle`, `focusing`, and `done`.

- `beginHold` switches to `focusing`, starts the audio context, and resets the copy band.
- While focusing, `progress` climbs by `dt / 12`.
- While idle, `progress` drains by `dt * 0.85`. A full hold therefore empties in about 1.18 seconds.
- When `progress` reaches 1, `startBloom` switches to `done`, absorbs every chip, plays the bloom chord, and spawns 120 bloom particles.
- `reset` returns to `idle`, rebuilds the chips, and clears the particles.
- `dt` is clamped to 50 ms so a background tab does not jump the simulation.

Input is intentionally redundant:

- `Space` or `Enter` starts and ends a hold.
- Pointer down on the keycap starts, pointer up or cancel ends.
- `pointerup` on the window, window blur, and tab hide all end a hold.
- Interactive elements such as links and buttons are ignored by the keyboard handler.
- The done state keeps the keycap live: another press resets and starts a new hold.

## Rendering

`src/main.ts` owns one `requestAnimationFrame` loop. The canvas is sized in CSS pixels multiplied by `min(devicePixelRatio, 2)`, then the context is scaled once. Scene coordinates stay in CSS pixels.

The orb:

- Radius is `min(stageWidth * 0.28, stageHeight * 0.34)`.
- A 256 by 256 random grayscale image is drawn inside a circular clip and drifts on two slow sine offsets.
- Its alpha is `0.32 * (1 - focus * 0.85)`, so it falls to about `0.048` at full focus.
- A mint radial gradient rises with focus, and a dark radial shade protects the rim.
- The progress ring sits at `r + max(16, r * 0.12)` and starts at negative 90 degrees.
- The completion bloom runs for 3.6 seconds and expands to 2.9 times the orb radius.

Particles:

- Ambient dust spawns every 0.14 seconds and drifts upward.
- Each absorbed chip emits 14 particles that accelerate toward the orb center.
- The done state emits 120 particles outward with drag and fade.
- Reduced motion skips dust, absorption particles, the noise texture, and the bloom burst.

## Chips

The chips are DOM elements, not canvas sprites, so their labels stay crisp. There are up to 8, or 5 below 720 px wide.

Each chip has an angle, speed, phase, and delay. For progress `p`:

```text
local = clamp((p - delay) / (1 - delay), 0, 1)
pull  = smoothstep(local)
orbit = angle + time * speed + pull * 3.4
scale = 1 - pull * 0.88
```

The orbit ellipse is `min(stageWidth * 0.37, 360)` by `min(stageHeight * 0.36, 190)`. A small independent sine wobble fades as `pull` rises.

A chip is absorbed when the user is still holding, `local > 0.9`, and its distance to the center is below `r * 1.25`. It fades out, emits particles, plays a chime panned by its horizontal position, and respawns 1.2 to 2.8 seconds later.

Copy bands change at `progress` 0.34 and 0.7. The done state replaces the copy with "It's quiet now."

## Audio

Everything is synthesized in `src/audio.ts`. The context is created on the first hold or unmute, never on page load.

- Three sine oscillators at 110, 164.81, and 220 Hz, detuned by -4, +3, and +6 cents.
- A lowpass filter moves from 340 Hz to 1240 Hz as focus rises.
- A looping filtered-noise layer sits behind the drone and thins with focus.
- The master gain is 0.16 into a compressor at -18 dB threshold and 4:1 ratio.
- Absorption chimes pick from 523.25, 587.33, 659.25, 783.99, and 880 Hz.
- The bloom plays an A major chord at 220, 277.18, 329.63, and 440 Hz.
- Mute is stored as `hush-muted` in `localStorage`. Storage failures fall back to the in-page toggle.

## Test hook

Append `?test` to the URL to expose a deterministic path through the simulation. The hook sets `data-hush-test` on the document and listens for events:

```js
document.dispatchEvent(new CustomEvent("hush:start"));
document.dispatchEvent(new CustomEvent("hush:step", { detail: { seconds: 1 / 60, count: 300 } }));
document.dispatchEvent(new CustomEvent("hush:end"));
document.dispatchEvent(new CustomEvent("hush:reset"));
```

`hush:step` accepts either a number of seconds or `{ seconds, count }`. It calls `update` and `render` directly, so it works when the tab is in the background and does not depend on the display refresh rate.

`window.__hush` exposes the same controls plus `state()`:

```js
__hush.start();
__hush.step(1 / 60, 720);
__hush.state();
__hush.reset();
```

This is a capture and manual test harness, not an automated test suite.

## Build and deploy

`npm run build` runs `tsc` and then `vite build`. The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` builds on Node 22 and deploys `dist` to GitHub Pages on every push to `main`.

The explainer build directory is ignored by Git. The film itself lives on the [`explainer-v1` release](https://github.com/jimmerioles/hush/releases/tag/explainer-v1), not in the repository.
