// Capture hook for Hush.
//
// The page exposes a deterministic test mode at `?test`: dispatch
// `hush:start`, step the simulation with `hush:step`, then screenshot.
// Every state below is real product output, not a mockup.

const VIEW = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function metrics(page, viewport, scale = 2) {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: scale,
    mobile: viewport.width < 500,
  });
  await client.detach();
}

async function step(page, seconds) {
  await page.evaluate((s) => {
    const frames = Math.round(s * 60);
    document.dispatchEvent(new CustomEvent("hush:step", { detail: { seconds: 1 / 60, count: frames } }));
  }, seconds);
}

export default async function capture({ page, config, out }) {
  const files = [];

  await metrics(page, VIEW, 2);
  await page.goto(config.capture.url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);

  await page.screenshot({ path: `${out}/hero-idle.png` });
  await page.locator("#scene").screenshot({ path: `${out}/orb-idle.png` });
  files.push("hero-idle.png", "orb-idle.png");

  await page.evaluate(() => document.dispatchEvent(new CustomEvent("hush:start")));
  await step(page, 4.2);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/hero-focus.png` });
  await page.locator("#scene").screenshot({ path: `${out}/orb-focus.png` });
  files.push("hero-focus.png", "orb-focus.png");

  await step(page, 4.8);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/hero-late.png` });
  await page.locator("#scene").screenshot({ path: `${out}/orb-late.png` });
  files.push("hero-late.png", "orb-late.png");

  await step(page, 2.0);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/hero-quiet.png` });
  await page.locator("#scene").screenshot({ path: `${out}/orb-quiet.png` });
  files.push("hero-quiet.png", "orb-quiet.png");

  await page.evaluate(() => document.dispatchEvent(new CustomEvent("hush:reset")));
  await page.waitForTimeout(300);
  await metrics(page, MOBILE, 2);
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/mobile-idle.png`, fullPage: true });
  files.push("mobile-idle.png");

  return files;
}
