import "./case-study.css";

const progressBar = document.querySelector<HTMLElement>("#cs-progress");

let queued = false;

function paintProgress(): void {
  queued = false;
  if (!progressBar) return;

  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
  const clamped = Math.min(1, Math.max(0, ratio));
  progressBar.style.transform = `scaleX(${clamped})`;
}

function queueProgress(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(paintProgress);
}

window.addEventListener("scroll", queueProgress, { passive: true });
window.addEventListener("resize", queueProgress);
window.addEventListener("load", queueProgress);

paintProgress();
