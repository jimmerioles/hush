import { describe, expect, it } from "vitest";
import {
  CHIP_ABSORB_LOCAL,
  CHIP_ABSORB_RADIUS,
  CHIP_SCALE,
  COMPLETE_AT,
  COPY_BANDS,
  DRAIN_PER_SECOND,
  HOLD_SECONDS,
  chipLocal,
  chipPose,
  clamp,
  complete,
  copyBand,
  createSimulation,
  isAbsorbable,
  readoutFor,
  smoothstep,
  stepSimulation,
} from "../../src/simulation.ts";

describe("clamp and smoothstep", () => {
  it("clamps to the closed range", () => {
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(2, 0, 1)).toBe(1);
  });

  it("eases from 0 to 1 on a smooth curve", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
  });
});

describe("copy bands and readout", () => {
  it("switches bands at 0.34 and 0.7", () => {
    expect(copyBand(0)).toBe(0);
    expect(copyBand(COPY_BANDS[0] - 0.001)).toBe(0);
    expect(copyBand(COPY_BANDS[0])).toBe(1);
    expect(copyBand(COPY_BANDS[1] - 0.001)).toBe(1);
    expect(copyBand(COPY_BANDS[1])).toBe(2);
    expect(copyBand(1)).toBe(2);
  });

  it("prints seconds of focus from progress", () => {
    expect(readoutFor(0)).toBe("0.0");
    expect(readoutFor(0.5)).toBe("6.0");
    expect(readoutFor(1)).toBe("12.0");
  });
});

describe("stepSimulation", () => {
  it("climbs at one twelfth per second while focusing", () => {
    const state = createSimulation();
    state.phase = "focusing";
    state.holding = true;

    const result = stepSimulation(state, 1);

    expect(result.phaseBefore).toBe("focusing");
    expect(result.completed).toBe(false);
    expect(state.progress).toBeCloseTo(1 / HOLD_SECONDS, 12);
    expect(state.time).toBe(1);
    expect(state.phase).toBe("focusing");
  });

  it("completes after twelve seconds at 60 fps", () => {
    const state = createSimulation();
    state.phase = "focusing";
    state.holding = true;

    let completedAt = 0;
    for (let frame = 1; frame <= 60 * HOLD_SECONDS; frame++) {
      const { completed } = stepSimulation(state, 1 / 60);
      if (completed) {
        completedAt = frame;
        break;
      }
    }

    expect(completedAt).toBe(60 * HOLD_SECONDS);
    expect(state.phase).toBe("done");
    expect(state.progress).toBe(1);
    expect(state.holding).toBe(false);
    expect(state.bloom).toBe(0);
  });

  it("drains at 0.85 per second when idle", () => {
    const state = createSimulation();
    state.progress = 0.5;

    stepSimulation(state, 0.2);

    expect(state.progress).toBeCloseTo(0.5 - 0.2 * DRAIN_PER_SECOND, 12);
    expect(state.phase).toBe("idle");
  });

  it("floors drained progress at zero", () => {
    const state = createSimulation();
    state.progress = 0.1;

    stepSimulation(state, 1);

    expect(state.progress).toBe(0);
  });

  it("advances the bloom timer when done", () => {
    const state = createSimulation();
    state.phase = "done";
    state.progress = 1;

    stepSimulation(state, 1.5);

    expect(state.bloom).toBe(1.5);
    expect(state.progress).toBe(1);
    expect(state.time).toBe(1.5);
  });

  it("completes with the reduced motion bloom offset", () => {
    const state = createSimulation();
    state.phase = "focusing";
    state.holding = true;
    state.progress = COMPLETE_AT;

    const result = stepSimulation(state, 1 / 60, true);

    expect(result.completed).toBe(true);
    expect(state.phase).toBe("done");
    expect(state.bloom).toBe(4);
  });
});

describe("complete", () => {
  it("lands on one and clears the hold", () => {
    const state = createSimulation();
    state.phase = "focusing";
    state.holding = true;
    state.progress = 0.4;
    state.bloom = 2;

    complete(state);

    expect(state.phase).toBe("done");
    expect(state.progress).toBe(1);
    expect(state.holding).toBe(false);
    expect(state.bloom).toBe(0);
  });

  it("skips the bloom for reduced motion", () => {
    const state = createSimulation();

    complete(state, true);

    expect(state.bloom).toBe(4);
  });
});

describe("chip motion", () => {
  it("staggers chips by their delay", () => {
    expect(chipLocal(0, 0)).toBe(0);
    expect(chipLocal(0.5, 0)).toBe(0.5);
    expect(chipLocal(1, 0)).toBe(1);

    expect(chipLocal(0.2, 0.28)).toBe(0);
    expect(chipLocal(0.64, 0.28)).toBeCloseTo(0.5, 12);
    expect(chipLocal(1, 0.28)).toBe(1);
  });

  it("clamps local progress at both ends", () => {
    expect(chipLocal(-1, 0)).toBe(0);
    expect(chipLocal(2, 0)).toBe(1);
  });

  it("starts on the orbit and shrinks as it is pulled in", () => {
    const stage = { cx: 100, cy: 50, rx: 200, ry: 100 };
    const chip = { angle: 0, speed: 0, phase: 0, delay: 0 };

    const idle = chipPose(chip, 0, 0, stage);
    expect(idle.local).toBe(0);
    expect(idle.pull).toBe(0);
    expect(idle.scale).toBe(1);
    expect(idle.x).toBeCloseTo(300, 12);
    expect(idle.y).toBeCloseTo(53, 12);

    const done = chipPose(chip, 1, 0, stage);
    expect(done.local).toBe(1);
    expect(done.pull).toBe(1);
    expect(done.scale).toBeCloseTo(1 - CHIP_SCALE, 12);
    expect(done.x).toBeCloseTo(100 + Math.cos(3.4) * 200 * (1 - CHIP_SCALE), 12);
    expect(done.y).toBeCloseTo(50 + Math.sin(3.4) * 100 * (1 - CHIP_SCALE), 12);
  });

  it("only absorbs while holding, past the threshold, near the orb", () => {
    const r = 100;

    expect(isAbsorbable(false, 1, 0, r)).toBe(false);
    expect(isAbsorbable(true, CHIP_ABSORB_LOCAL, 0, r)).toBe(false);
    expect(
      isAbsorbable(true, CHIP_ABSORB_LOCAL + 0.01, r * CHIP_ABSORB_RADIUS, r),
    ).toBe(false);
    expect(
      isAbsorbable(
        true,
        CHIP_ABSORB_LOCAL + 0.01,
        r * CHIP_ABSORB_RADIUS - 0.01,
        r,
      ),
    ).toBe(true);
  });
});
