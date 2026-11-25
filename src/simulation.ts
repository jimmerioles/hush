/**
 * Pure Hush simulation: phase, progress, copy bands, and chip motion.
 *
 * Nothing here touches the DOM, canvas, or Web Audio, so the numbers that
 * drive the instrument can be tested in Node.
 */

export type Phase = "idle" | "focusing" | "done";

export type SimulationState = {
  phase: Phase;
  progress: number;
  holding: boolean;
  time: number;
  bloom: number;
};

export type StageGeometry = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type ChipState = {
  angle: number;
  speed: number;
  phase: number;
  delay: number;
};

export type ChipPose = {
  x: number;
  y: number;
  scale: number;
  local: number;
  pull: number;
};

export type StepResult = {
  completed: boolean;
  phaseBefore: Phase;
};

export const HOLD_SECONDS = 12;
export const DRAIN_PER_SECOND = 0.85;
export const COMPLETE_AT = 0.9999;
export const IDLE_AT = 0.001;
export const COPY_BANDS = [0.34, 0.7] as const;
export const CHIP_PULL_TURNS = 3.4;
export const CHIP_SCALE = 0.88;
export const CHIP_ABSORB_LOCAL = 0.9;
export const CHIP_ABSORB_RADIUS = 1.25;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function createSimulation(): SimulationState {
  return { phase: "idle", progress: 0, holding: false, time: 0, bloom: 0 };
}

export function copyBand(progress: number): number {
  if (progress < COPY_BANDS[0]) return 0;
  if (progress < COPY_BANDS[1]) return 1;
  return 2;
}

export function readoutFor(progress: number): string {
  return (progress * HOLD_SECONDS).toFixed(1);
}

export function complete(state: SimulationState, reduced = false): void {
  state.phase = "done";
  state.progress = 1;
  state.holding = false;
  state.bloom = reduced ? 4 : 0;
}

export function stepSimulation(
  state: SimulationState,
  dt: number,
  reduced = false,
): StepResult {
  const phaseBefore = state.phase;
  state.time += dt;

  let completed = false;

  if (state.phase === "focusing") {
    state.progress = Math.min(1, state.progress + dt / HOLD_SECONDS);
    if (state.progress >= COMPLETE_AT) {
      complete(state, reduced);
      completed = true;
    }
  } else if (state.phase === "idle") {
    state.progress = Math.max(0, state.progress - dt * DRAIN_PER_SECOND);
  } else {
    state.bloom += dt;
  }

  return { completed, phaseBefore };
}

export function chipLocal(progress: number, delay: number): number {
  return clamp((progress - delay) / (1 - delay), 0, 1);
}

export function chipPose(
  chip: ChipState,
  progress: number,
  time: number,
  stage: StageGeometry,
): ChipPose {
  const local = chipLocal(progress, chip.delay);
  const pull = smoothstep(local);
  const orbit = chip.angle + time * chip.speed + pull * CHIP_PULL_TURNS;
  const scale = 1 - pull * CHIP_SCALE;
  const wobble = 1 - pull;

  return {
    x:
      stage.cx +
      Math.cos(orbit) * stage.rx * scale +
      Math.sin(time * 0.8 + chip.phase) * 3 * wobble,
    y:
      stage.cy +
      Math.sin(orbit) * stage.ry * scale +
      Math.cos(time * 0.95 + chip.phase) * 3 * wobble,
    scale,
    local,
    pull,
  };
}

export function isAbsorbable(
  holding: boolean,
  local: number,
  distance: number,
  orbRadius: number,
): boolean {
  return (
    holding &&
    local > CHIP_ABSORB_LOCAL &&
    distance < orbRadius * CHIP_ABSORB_RADIUS
  );
}
