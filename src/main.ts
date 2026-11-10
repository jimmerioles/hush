import "./style.css";
import { AudioEngine } from "./audio.ts";

type Phase = "idle" | "focusing" | "done";

type StageSize = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
};

type Chip = {
  el: HTMLDivElement;
  angle: number;
  speed: number;
  phase: number;
  delay: number;
  x: number;
  y: number;
  absorbed: boolean;
  respawnAt: number;
};

type ParticleKind = "dust" | "absorb" | "bloom";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
};

const HOLD_SECONDS = 12;
const MAX_CHIPS = 8;
const TAU = Math.PI * 2;

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Hush: missing ${selector}`);
  return element;
}

function get2dContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext("2d");
  if (!context) throw new Error("Hush: Canvas 2D is unavailable.");
  return context;
}

const canvas = mustQuery<HTMLCanvasElement>("#scene");
const stage = mustQuery<HTMLElement>("#stage");
const chipsEl = mustQuery<HTMLDivElement>("#chips");
const keycap = mustQuery<HTMLButtonElement>("#keycap");
const headline = mustQuery<HTMLElement>("#headline");
const subcopy = mustQuery<HTMLElement>("#subcopy");
const readout = mustQuery<HTMLElement>("#readout");
const orbCaption = mustQuery<HTMLElement>("#orb-caption");
const orbState = mustQuery<HTMLElement>("#orb-state");
const cta = mustQuery<HTMLElement>("#cta");
const ctaButton = mustQuery<HTMLButtonElement>("#cta-button");
const soundButton = mustQuery<HTMLButtonElement>("#sound");

const ctx = get2dContext(canvas);
const keycapLabel = keycap.querySelector<HTMLElement>(".keycap-label")!;
const keycapHint = keycap.querySelector<HTMLElement>(".keycap-hint")!;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const audio = new AudioEngine();

const state = {
  phase: "idle" as Phase,
  progress: 0,
  holding: false,
  time: 0,
  bloom: 0,
  size: { w: 0, h: 0, cx: 0, cy: 0, r: 0 } as StageSize,
};

const chips: Chip[] = [];
const particles: Particle[] = [];
let lastFocusBand = -1;
let chipCount = 0;
let dustAcc = 0;
let muted = false;
try {
  muted = localStorage.getItem("hush-muted") === "1";
} catch {
  muted = false;
}

const CHIP_DATA = [
  { icon: "✉", label: "Email", meta: "3 new" },
  { icon: "#", label: "Slack", meta: "standup" },
  { icon: "◷", label: "Calendar", meta: "in 5 min" },
  { icon: "X", label: "X", meta: "12 replies" },
  { icon: "✓", label: "Tasks", meta: "4 due" },
  { icon: "▤", label: "News", meta: "daily" },
  { icon: "◆", label: "DM", meta: "1 unread" },
  { icon: "★", label: "Review", meta: "2 waiting" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function makeNoise(size: number): HTMLCanvasElement {
  const noise = document.createElement("canvas");
  noise.width = size;
  noise.height = size;
  const noiseCtx = noise.getContext("2d");
  if (!noiseCtx) return noise;

  const image = noiseCtx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.random() * 255;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  noiseCtx.putImageData(image, 0, 0);
  return noise;
}

const noiseCanvas = makeNoise(256);

function setCopy(headlineHtml: string, subcopyText: string): void {
  if (headline.innerHTML !== headlineHtml) headline.innerHTML = headlineHtml;
  if (subcopy.textContent !== subcopyText) subcopy.textContent = subcopyText;
}

function setOrbState(label: "noise" | "focus" | "quiet"): void {
  orbState.textContent = label;
  orbCaption.classList.toggle("is-focus", label === "focus");
  orbCaption.classList.toggle("is-quiet", label === "quiet");
}

function setIdleCopy(): void {
  if (lastFocusBand === -2) return;
  lastFocusBand = -2;
  setCopy("Make room for <em>one thing.</em>", "Notifications are noise. Hold to focus.");
  setOrbState("noise");
}

function updateFocusCopy(): void {
  const band = state.progress < 0.34 ? 0 : state.progress < 0.7 ? 1 : 2;
  if (band === lastFocusBand) return;
  lastFocusBand = band;

  if (band === 0) {
    setCopy("Stay with <em>it.</em>", "The noise is thinning.");
  } else if (band === 1) {
    setCopy("Almost <em>quiet.</em>", "Keep holding.");
  } else {
    setCopy("Don't let <em>go.</em>", "One more breath.");
  }
  setOrbState("focus");
}

function buildChips(): void {
  chipsEl.innerHTML = "";
  chips.length = 0;

  const count = window.matchMedia("(max-width: 720px)").matches ? 5 : MAX_CHIPS;
  chipCount = count;

  for (let i = 0; i < count; i++) {
    const data = CHIP_DATA[i % CHIP_DATA.length];

    const el = document.createElement("div");
    el.className = "chip";
    el.style.opacity = "0";

    const icon = document.createElement("span");
    icon.className = "chip-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = data.icon;

    const copy = document.createElement("span");
    copy.className = "chip-copy";

    const label = document.createElement("span");
    label.className = "chip-label";
    label.textContent = data.label;

    const meta = document.createElement("span");
    meta.className = "chip-meta";
    meta.textContent = data.meta;

    copy.append(label, meta);
    el.append(icon, copy);
    chipsEl.appendChild(el);

    chips.push({
      el,
      angle: (i / count) * TAU + Math.random() * 0.4,
      speed: 0.1 + Math.random() * 0.16,
      phase: Math.random() * TAU,
      delay: Math.random() * 0.28,
      x: 0,
      y: 0,
      absorbed: false,
      respawnAt: 0,
    });
  }
}

function resize(): void {
  const rect = stage.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.size = {
    w: rect.width,
    h: rect.height,
    cx: rect.width / 2,
    cy: rect.height / 2,
    r: Math.min(rect.width * 0.28, rect.height * 0.34),
  };

  const nextCount = window.matchMedia("(max-width: 720px)").matches ? 5 : MAX_CHIPS;
  if (nextCount !== chipCount) buildChips();
}

function spawnAbsorb(x: number, y: number): void {
  if (reduced) return;
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * TAU;
    const speed = 20 + Math.random() * 90;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.45 + Math.random() * 0.5,
      size: 0.8 + Math.random() * 1.8,
      kind: "absorb",
    });
  }
}

function spawnDust(dt: number): void {
  if (reduced) return;
  dustAcc += dt;
  if (dustAcc < 0.14) return;
  dustAcc = 0;

  const { cx, cy, r } = state.size;
  const angle = Math.random() * TAU;
  const distance = r * (1.1 + Math.random() * 1.5);

  particles.push({
    x: cx + Math.cos(angle) * distance,
    y: cy + Math.sin(angle) * distance * 0.75,
    vx: (Math.random() - 0.5) * 8,
    vy: -5 - Math.random() * 10,
    life: 0,
    maxLife: 2.6 + Math.random() * 3,
    size: 0.6 + Math.random() * 1.2,
    kind: "dust",
  });
}

function updateChips(): void {
  if (state.phase === "done") return;

  const { w, h, cx, cy, r } = state.size;
  const rx = Math.min(w * 0.37, 360);
  const ry = Math.min(h * 0.36, 190);

  for (const chip of chips) {
    if (chip.absorbed) {
      if (state.time >= chip.respawnAt) {
        chip.absorbed = false;
        chip.angle = Math.random() * TAU;
        chip.phase = Math.random() * TAU;
        chip.delay = Math.random() * 0.28;
        chip.el.style.opacity = "0";
      }
      continue;
    }

    const local = clamp((state.progress - chip.delay) / (1 - chip.delay), 0, 1);
    const pull = smoothstep(local);
    const orbit = chip.angle + state.time * chip.speed + pull * 3.4;
    const scale = 1 - pull * 0.88;

    const x =
      cx +
      Math.cos(orbit) * rx * scale +
      Math.sin(state.time * 0.8 + chip.phase) * 3 * (1 - pull);
    const y =
      cy +
      Math.sin(orbit) * ry * scale +
      Math.cos(state.time * 0.95 + chip.phase) * 3 * (1 - pull);

    chip.x = x;
    chip.y = y;

    const distance = Math.hypot(x - cx, y - cy);
    if (state.holding && local > 0.9 && distance < r * 1.25) {
      chip.absorbed = true;
      chip.el.style.opacity = "0";
      chip.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(0.4)`;
      spawnAbsorb(x, y);
      audio.chime(x / w);
      chip.respawnAt = state.time + 1.2 + Math.random() * 1.6;
      continue;
    }

    chip.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
    chip.el.style.opacity = `${1 - pull * 0.45}`;
  }
}

function updateParticles(dt: number): void {
  const { cx, cy } = state.size;

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life += dt;

    if (particle.kind === "absorb") {
      const dx = cx - particle.x;
      const dy = cy - particle.y;
      const distance = Math.hypot(dx, dy) || 1;
      particle.vx += (dx / distance) * 900 * dt;
      particle.vy += (dy / distance) * 900 * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
    } else {
      particle.vx *= 0.985;
      particle.vy *= 0.985;
    }

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;

    if (particle.life >= particle.maxLife) particles.splice(i, 1);
  }
}

function drawParticles(): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const particle of particles) {
    const remaining = 1 - particle.life / particle.maxLife;
    if (remaining <= 0) continue;

    const alpha = particle.kind === "dust" ? 0.2 * remaining : 0.55 * remaining;
    ctx.fillStyle =
      particle.kind === "bloom"
        ? `rgba(235, 255, 242, ${alpha})`
        : `rgba(184, 255, 207, ${alpha})`;

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function render(): void {
  const { w, h, cx, cy, r } = state.size;
  if (r <= 0) return;

  ctx.clearRect(0, 0, w, h);

  const focus = state.phase === "done" ? 1 : state.progress;

  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.9);
  glow.addColorStop(0, `rgba(184, 255, 207, ${0.05 + focus * 0.07})`);
  glow.addColorStop(1, "rgba(184, 255, 207, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();

  const base = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  base.addColorStop(0, "#16181b");
  base.addColorStop(1, "#070708");
  ctx.fillStyle = base;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  if (!reduced) {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.32 * (1 - focus * 0.85);
    const offsetX = Math.sin(state.time * 0.7) * r * 0.35;
    const offsetY = Math.cos(state.time * 0.55) * r * 0.35;
    ctx.drawImage(noiseCanvas, cx - r + offsetX, cy - r + offsetY, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
  }

  const calm = ctx.createRadialGradient(
    cx - r * 0.22,
    cy - r * 0.3,
    r * 0.05,
    cx,
    cy,
    r * 0.98,
  );
  calm.addColorStop(0, `rgba(230, 255, 240, ${0.07 + focus * 0.24})`);
  calm.addColorStop(0.55, `rgba(184, 255, 207, ${0.03 + focus * 0.13})`);
  calm.addColorStop(1, "rgba(184, 255, 207, 0)");
  ctx.fillStyle = calm;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  const shade = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  shade.addColorStop(0, "rgba(0, 0, 0, 0)");
  shade.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = `rgba(235, 255, 242, ${0.16 + focus * 0.34})`;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  const ringRadius = r + Math.max(16, r * 0.12);

  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 0, TAU);
  ctx.strokeStyle = "rgba(242, 242, 239, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (state.progress > 0.001) {
    const start = -Math.PI / 2;
    const end = start + TAU * state.progress;

    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, start, end);
    ctx.strokeStyle = "rgba(184, 255, 207, 0.9)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.stroke();

    const tipX = cx + Math.cos(end) * ringRadius;
    const tipY = cy + Math.sin(end) * ringRadius;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3.1, 0, TAU);
    ctx.fillStyle = "#eafff1";
    ctx.shadowColor = "rgba(184, 255, 207, 0.9)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawParticles();

  if (state.phase === "done" && state.bloom < 3.6) {
    const progress = Math.min(1, state.bloom / 2.4);
    const bloomRadius = r * (1 + progress * 1.9);
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
    bloom.addColorStop(0, `rgba(235, 255, 242, ${0.34 * (1 - progress)})`);
    bloom.addColorStop(0.45, `rgba(184, 255, 207, ${0.16 * (1 - progress)})`);
    bloom.addColorStop(1, "rgba(184, 255, 207, 0)");

    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(cx, cy, bloomRadius, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

function startBloom(): void {
  if (state.phase === "done") return;

  state.phase = "done";
  state.progress = 1;
  state.holding = false;
  state.bloom = reduced ? 4 : 0;

  keycap.toggleAttribute("data-pressed", false);
  keycap.setAttribute("aria-pressed", "false");
  keycap.dataset.done = "true";
  keycap.setAttribute("aria-label", "Hold to go again");
  keycapLabel.textContent = "again";
  keycapHint.textContent = "hold to go again";

  setCopy("It's <em>quiet</em> now.", "That's what focus feels like. Go again?");
  setOrbState("quiet");
  readout.textContent = HOLD_SECONDS.toFixed(1);
  audio.bloom();

  for (const chip of chips) {
    chip.absorbed = true;
    chip.el.style.opacity = "0";
  }

  const burst = reduced ? 0 : 120;
  for (let i = 0; i < burst; i++) {
    const angle = Math.random() * TAU;
    const speed = 30 + Math.random() * 260;
    particles.push({
      x: state.size.cx + Math.cos(angle) * state.size.r * 0.4,
      y: state.size.cy + Math.sin(angle) * state.size.r * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 18,
      life: 0,
      maxLife: 1.2 + Math.random() * 2.2,
      size: 0.8 + Math.random() * 2.6,
      kind: "bloom",
    });
  }

  cta.hidden = false;
  requestAnimationFrame(() => {
    if (!cta.hidden) cta.classList.add("is-visible");
  });
}

function reset(): void {
  state.phase = "idle";
  state.progress = 0;
  state.holding = false;
  state.bloom = 0;
  particles.length = 0;

  keycap.removeAttribute("data-done");
  keycap.toggleAttribute("data-pressed", false);
  keycap.setAttribute("aria-pressed", "false");
  keycap.setAttribute("aria-label", "Hold to focus");
  keycapLabel.textContent = "space";
  keycapHint.textContent = "hold to focus";

  cta.classList.remove("is-visible");
  cta.hidden = true;
  readout.textContent = "0.0";

  lastFocusBand = -1;
  setIdleCopy();
  audio.setFocus(0);
  buildChips();
}

function beginHold(): void {
  if (state.holding) return;
  if (state.phase === "done") reset();

  state.holding = true;
  state.phase = "focusing";
  lastFocusBand = -1;

  keycap.toggleAttribute("data-pressed", true);
  keycap.setAttribute("aria-pressed", "true");
  setOrbState("focus");
  setCopy("Stay with <em>it.</em>", "The noise is thinning.");

  void audio
    .start()
    .then(() => audio.setMuted(muted))
    .catch(() => {});
}

function endHold(): void {
  if (!state.holding) return;

  state.holding = false;
  keycap.toggleAttribute("data-pressed", false);
  keycap.setAttribute("aria-pressed", "false");

  if (state.phase === "focusing") {
    state.phase = "idle";
    setIdleCopy();
  }
}

function update(dt: number): void {
  state.time += dt;

  if (state.phase === "focusing") {
    state.progress = Math.min(1, state.progress + dt / HOLD_SECONDS);
    audio.setFocus(state.progress);
    updateFocusCopy();
    if (state.progress >= 0.9999) startBloom();
  } else if (state.phase === "idle") {
    state.progress = Math.max(0, state.progress - dt * 0.85);
    audio.setFocus(state.progress);
    if (state.progress <= 0.001) setIdleCopy();
  } else if (state.phase === "done") {
    state.bloom += dt;
  }

  updateChips();
  updateParticles(dt);
  spawnDust(dt);

  readout.textContent = (state.progress * HOLD_SECONDS).toFixed(1);
}

function applyMuted(): void {
  soundButton.dataset.muted = muted ? "true" : "false";
  soundButton.setAttribute("aria-pressed", String(muted));
  soundButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  audio.setMuted(muted);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target === keycap) return false;
  return Boolean(
    target.closest("button, a, input, textarea, select, [contenteditable='true']"),
  );
}

keycap.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  try {
    keycap.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is a nicety, not a requirement.
  }
  beginHold();
});

keycap.addEventListener("pointerup", (event) => {
  event.preventDefault();
  endHold();
});

keycap.addEventListener("pointercancel", endHold);
keycap.addEventListener("lostpointercapture", endHold);
keycap.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("pointerup", endHold);
window.addEventListener("blur", endHold);

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code !== "Space" && event.key !== "Enter") return;
  if (isInteractiveTarget(event.target)) return;
  event.preventDefault();
  beginHold();
});

window.addEventListener("keyup", (event) => {
  if (event.code !== "Space" && event.key !== "Enter") return;
  endHold();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) endHold();
  last = performance.now();
});

soundButton.addEventListener("click", () => {
  muted = !muted;
  try {
    localStorage.setItem("hush-muted", muted ? "1" : "0");
  } catch {
    // Storage can be unavailable; the toggle still works for this page.
  }
  applyMuted();
  if (!muted) {
    void audio
      .start()
      .then(() => audio.setMuted(false))
      .catch(() => {});
  }
});

ctaButton.addEventListener("click", () => {
  reset();
  keycap.focus();
});

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

const resizeObserver = new ResizeObserver(() => resize());
resizeObserver.observe(stage);

applyMuted();
setIdleCopy();
resize();
void document.fonts.ready.then(() => resize());

const testMode = new URLSearchParams(location.search).has("test");
if (testMode) {
  document.documentElement.dataset.hushTest = "1";
  document.addEventListener("hush:start", () => beginHold());
  document.addEventListener("hush:end", () => endHold());
  document.addEventListener("hush:reset", () => reset());
  document.addEventListener("hush:step", (event) => {
    const detail = (event as CustomEvent<number | { seconds: number; count: number }>).detail;
    if (typeof detail === "number") {
      update(detail);
      render();
    } else if (detail && typeof detail.seconds === "number" && typeof detail.count === "number") {
      for (let i = 0; i < detail.count; i++) update(detail.seconds);
      render();
    }
  });
  (window as unknown as { __hush: unknown }).__hush = {
    start: beginHold,
    end: endHold,
    reset,
    step: (seconds = 1 / 60, count = 1) => {
      for (let i = 0; i < count; i++) update(seconds);
      render();
      return {
        phase: state.phase,
        progress: state.progress,
        readout: readout.textContent,
        copy: subcopy.textContent,
        done: keycap.hasAttribute("data-done"),
        cta: !cta.hidden,
      };
    },
    state: () => ({
      phase: state.phase,
      progress: state.progress,
      readout: readout.textContent,
      copy: subcopy.textContent,
      done: keycap.hasAttribute("data-done"),
      cta: !cta.hidden,
    }),
  };
}

requestAnimationFrame(frame);
