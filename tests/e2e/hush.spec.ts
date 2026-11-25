import { expect, test, type Page } from "@playwright/test";

type HushState = {
  phase: "idle" | "focusing" | "done";
  progress: number;
  readout: string;
  copy: string;
  done: boolean;
  cta: boolean;
};

type HushApi = {
  start: () => void;
  end: () => void;
  reset: () => void;
  step: (seconds?: number, count?: number) => HushState;
  state: () => HushState;
};

function hush(page: Page) {
  return {
    state: () =>
      page.evaluate(
        () => (window as unknown as { __hush: HushApi }).__hush.state(),
      ),
    step: (frames: number) =>
      page.evaluate(
        (count) =>
          (window as unknown as { __hush: HushApi }).__hush.step(
            1 / 60,
            count,
          ),
        frames,
      ),
  };
}

async function openInstrument(page: Page): Promise<void> {
  await page.goto("/?test");
  await expect(page.locator("html")).toHaveAttribute("data-hush-test", "1");
  await expect(page.locator("#keycap")).toBeVisible();
}

test("the instrument loads without uncaught errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#keycap")).toBeVisible();
  await expect(page.locator(".chip")).toHaveCount(8);

  expect(errors).toEqual([]);
});

test("a full hold lands on the quiet state", async ({ page }) => {
  await openInstrument(page);

  await page.keyboard.down("Space");
  await expect
    .poll(async () => (await hush(page).state()).phase)
    .toBe("focusing");

  const state = await hush(page).step(12 * 60);

  expect(state.phase).toBe("done");
  expect(state.progress).toBe(1);
  expect(state.readout).toBe("12.0");
  expect(state.done).toBe(true);
  expect(state.cta).toBe(true);

  await expect(page.locator("#keycap")).toHaveAttribute("data-done", "true");
  await expect(page.locator("#keycap")).toHaveAttribute(
    "aria-label",
    "Hold to go again",
  );
  await expect(page.locator(".keycap-label")).toHaveText("again");
  await expect(page.locator("#subcopy")).toHaveText(
    "That's what focus feels like. Go again?",
  );
  await expect(page.locator("#orb-state")).toHaveText("quiet");
  await expect(page.locator("#cta")).toBeVisible();

  await page.keyboard.up("Space");
});

test("releasing early drains back to idle", async ({ page }) => {
  await openInstrument(page);

  await page.keyboard.down("Space");
  await hush(page).step(3 * 60);
  await page.keyboard.up("Space");

  const released = await hush(page).state();
  expect(released.phase).toBe("idle");
  expect(released.done).toBe(false);

  const drained = await hush(page).step(30);

  expect(drained.phase).toBe("idle");
  expect(drained.progress).toBe(0);
  expect(drained.readout).toBe("0.0");
  expect(drained.cta).toBe(false);

  await expect(page.locator(".keycap-label")).toHaveText("space");
  await expect(page.locator("#subcopy")).toHaveText(
    "Notifications are noise. Hold to focus.",
  );
});

test("copy follows the focus bands", async ({ page }) => {
  await openInstrument(page);

  await page.keyboard.down("Space");
  await expect(page.locator("#subcopy")).toHaveText("The noise is thinning.");

  await hush(page).step(260);
  await expect(page.locator("#subcopy")).toHaveText("Keep holding.");
  await expect(page.locator("#orb-state")).toHaveText("focus");

  await hush(page).step(300);
  await expect(page.locator("#subcopy")).toHaveText("One more breath.");

  await page.keyboard.up("Space");
});

test("go again resets the instrument", async ({ page }) => {
  await openInstrument(page);

  await page.keyboard.down("Space");
  await hush(page).step(12 * 60);
  await page.keyboard.up("Space");

  await expect(page.locator("#cta")).toBeVisible();
  await page.locator("#cta-button").click();

  const state = await hush(page).state();
  expect(state.phase).toBe("idle");
  expect(state.progress).toBe(0);
  expect(state.readout).toBe("0.0");
  expect(state.done).toBe(false);
  expect(state.cta).toBe(false);

  await expect(page.locator("#cta")).toBeHidden();
  await expect(page.locator("#keycap")).not.toHaveAttribute("data-done");
  await expect(page.locator(".keycap-label")).toHaveText("space");
});

test("the case study paints scroll progress", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/case-study.html");
  const bar = page.locator("#cs-progress");
  await expect(bar).toBeAttached();

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );

  await expect
    .poll(() => bar.evaluate((el) => (el as HTMLElement).style.transform))
    .toBe("scaleX(1)");

  expect(errors).toEqual([]);
});
