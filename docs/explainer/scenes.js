import {
  W,
  H,
  ctx,
  C,
  F,
  M,
  IMG,
  clamp,
  lerp,
  smooth,
  easeOut,
  easeInOut,
  span,
  pulse,
  withAlpha,
  mulberry32,
  font,
  text,
  label,
  paragraph,
  revealText,
  panel,
  rrect,
  line,
  curve,
  arrow,
  dot,
  ring,
  glow,
  image,
  drawSine,
  drawWaveforms,
  sceneLabel,
} from "/kit/render/helpers.js";

// data

const TAU = Math.PI * 2;
const HOLD = 12;

const CHIPS = [
  { label: "Email", meta: "3 new", icon: "mail", angle: 0.0, speed: 0.07, delay: 0.0 },
  { label: "Slack", meta: "standup", icon: "hash", angle: 0.785, speed: 0.072, delay: 0.06 },
  { label: "Calendar", meta: "in 5 min", icon: "cal", angle: 1.571, speed: 0.074, delay: 0.12 },
  { label: "X", meta: "12 replies", icon: "x", angle: 2.356, speed: 0.076, delay: 0.18 },
  { label: "Tasks", meta: "4 due", icon: "check", angle: 3.142, speed: 0.078, delay: 0.24 },
  { label: "News", meta: "daily", icon: "news", angle: 3.927, speed: 0.08, delay: 0.3 },
  { label: "DM", meta: "1 unread", icon: "dm", angle: 4.712, speed: 0.082, delay: 0.36 },
  { label: "Review", meta: "2 waiting", icon: "star", angle: 5.498, speed: 0.084, delay: 0.42 },
];

// The product uses Math.random() once per page load. The film needs the same
// texture every render, so the grain is seeded instead.
const NOISE = (() => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  const img = g.createImageData(256, 256);
  const rnd = mulberry32(20261124);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
})();

// helpers

function times(sc) {
  return sc.seg.sentences.map((s) => ({
    start: s.start - sc.start,
    end: s.end - sc.start,
    dur: s.duration,
    text: s.text,
  }));
}

function at(s, i, fallback = 0) {
  return s[i]?.start ?? fallback;
}

function header(str) {
  sceneLabel(str, 110, 80);
}

function mono(str, x, y, opts = {}) {
  text(str, x, y, { family: F.mono, ...opts });
}

function minor(str, x, y, opts = {}) {
  text(str, x, y, {
    family: F.mono,
    size: 14,
    color: C.faint,
    ls: 2.4,
    ...opts,
  });
}

function icon(name, x, y, s = 16, color = C.dim, alpha = 1, lw = 1.4) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const h = s / 2;
  if (name === "mail") {
    ctx.beginPath();
    ctx.roundRect(x - h, y - h * 0.72, s, s * 0.72, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - h + 2, y - h * 0.62);
    ctx.lineTo(x, y + 1);
    ctx.lineTo(x + h - 2, y - h * 0.62);
    ctx.stroke();
  } else if (name === "hash") {
    ctx.beginPath();
    ctx.moveTo(x - h * 0.55, y - h);
    ctx.lineTo(x - h * 0.2, y + h);
    ctx.moveTo(x + h * 0.2, y - h);
    ctx.lineTo(x + h * 0.55, y + h);
    ctx.moveTo(x - h, y - h * 0.32);
    ctx.lineTo(x + h, y - h * 0.32);
    ctx.moveTo(x - h, y + h * 0.32);
    ctx.lineTo(x + h, y + h * 0.32);
    ctx.stroke();
  } else if (name === "cal") {
    ctx.beginPath();
    ctx.roundRect(x - h * 0.8, y - h * 0.68, s * 0.8, s * 0.8, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - h * 0.8, y - h * 0.25);
    ctx.lineTo(x + h * 0.8, y - h * 0.25);
    ctx.moveTo(x - h * 0.45, y - h);
    ctx.lineTo(x - h * 0.45, y - h * 0.75);
    ctx.moveTo(x + h * 0.45, y - h);
    ctx.lineTo(x + h * 0.45, y - h * 0.75);
    ctx.stroke();
    dot(x, y + h * 0.3, 1.5, color, alpha);
  } else if (name === "x") {
    ctx.beginPath();
    ctx.moveTo(x - h * 0.62, y - h * 0.62);
    ctx.lineTo(x + h * 0.62, y + h * 0.62);
    ctx.moveTo(x + h * 0.62, y - h * 0.62);
    ctx.lineTo(x - h * 0.62, y + h * 0.62);
    ctx.stroke();
  } else if (name === "check") {
    ctx.beginPath();
    ctx.moveTo(x - h * 0.7, y);
    ctx.lineTo(x - h * 0.12, y + h * 0.55);
    ctx.lineTo(x + h * 0.72, y - h * 0.62);
    ctx.stroke();
  } else if (name === "news") {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - h * 0.8, y - h * 0.55 + i * h * 0.55);
      ctx.lineTo(x + (i === 2 ? h * 0.2 : h * 0.8), y - h * 0.55 + i * h * 0.55);
      ctx.stroke();
    }
  } else if (name === "dm") {
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.78);
    ctx.lineTo(x + h * 0.78, y);
    ctx.lineTo(x, y + h * 0.78);
    ctx.lineTo(x - h * 0.78, y);
    ctx.closePath();
    ctx.stroke();
  } else if (name === "star") {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? h * 0.85 : h * 0.36;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (name === "cursor") {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 22);
    ctx.lineTo(x + 6, y + 16);
    ctx.lineTo(x + 12, y + 24);
    ctx.lineTo(x + 16, y + 21);
    ctx.lineTo(x + 10, y + 14);
    ctx.lineTo(x + 18, y + 13);
    ctx.closePath();
    ctx.fill();
  } else if (name === "audio") {
    ctx.beginPath();
    ctx.moveTo(x - h * 0.8, y - h * 0.28);
    ctx.lineTo(x - h * 0.4, y - h * 0.28);
    ctx.lineTo(x - h * 0.02, y - h * 0.62);
    ctx.lineTo(x - h * 0.02, y + h * 0.62);
    ctx.lineTo(x - h * 0.4, y + h * 0.28);
    ctx.lineTo(x - h * 0.8, y + h * 0.28);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + h * 0.1, y, h * 0.38, -0.8, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + h * 0.1, y, h * 0.72, -0.8, 0.8);
    ctx.stroke();
  } else if (name === "image") {
    ctx.beginPath();
    ctx.roundRect(x - h, y - h * 0.8, s, s * 0.8, 2);
    ctx.stroke();
    dot(x - h * 0.35, y - h * 0.3, 2.2, color, alpha);
    ctx.beginPath();
    ctx.moveTo(x - h, y + h * 0.5);
    ctx.lineTo(x - h * 0.2, y - h * 0.1);
    ctx.lineTo(x + h * 0.2, y + h * 0.2);
    ctx.lineTo(x + h * 0.55, y - h * 0.05);
    ctx.lineTo(x + h, y + h * 0.5);
    ctx.stroke();
  } else if (name === "server") {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.roundRect(x - h, y - h * 0.75 + i * h * 0.85, s, h * 0.65, 2);
      ctx.stroke();
      dot(x - h * 0.55, y - h * 0.43 + i * h * 0.85, 1.6, color, alpha);
    }
  }
  ctx.restore();
}

function drawChip(x, y, chip, opts = {}) {
  const {
    scale = 1,
    alpha = 1,
    accent = null,
    w = 176,
    h = 60,
    glowAmount = 0,
  } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);

  if (glowAmount > 0) {
    ctx.save();
    ctx.shadowColor = accent ?? C.mint;
    ctx.shadowBlur = 26 * glowAmount;
    rrect(x - w / 2, y - h / 2, w, h, 16);
    ctx.fillStyle = "rgba(14,17,20,0.9)";
    ctx.fill();
    ctx.restore();
  }

  rrect(x - w / 2, y - h / 2, w, h, 16);
  ctx.fillStyle = "rgba(14,17,20,0.92)";
  ctx.fill();
  ctx.strokeStyle = accent ? withAlpha(accent, 0.5) : "rgba(244,241,234,0.11)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  rrect(x - w / 2 + 13, y - h / 2 + 13, 34, 34, 9);
  ctx.fillStyle = "rgba(244,241,234,0.055)";
  ctx.fill();
  icon(chip.icon, x - w / 2 + 30, y + 1, 16, accent ?? "rgba(244,241,234,0.72)", 1, 1.25);

  text(chip.label, x - w / 2 + 60, y - 4, {
    size: 15,
    weight: 500,
    color: C.ink,
  });
  mono(chip.meta, x - w / 2 + 60, y + 18, {
    size: 11,
    color: "rgba(244,241,234,0.42)",
    ls: 0.5,
  });

  // small unread dot on the right
  dot(x + w / 2 - 16, y - h / 2 + 16, 2.2, accent ?? "rgba(244,241,234,0.2)", 1);
  ctx.restore();
}

function chipAt(chip, p, t, cx, cy, rx, ry) {
  const local = clamp((p - chip.delay) / (1 - chip.delay), 0, 1);
  const pull = smooth(local);
  const orbit = chip.angle + t * chip.speed + pull * 3.4;
  const s = 1 - pull * 0.88;
  return {
    x: cx + Math.cos(orbit) * rx * s,
    y: cy + Math.sin(orbit) * ry * s,
    scale: s,
    pull,
    local,
    orbit,
  };
}

function drawNoiseOrb(x, y, r, focus, t, alpha = 1, opts = {}) {
  if (r <= 0 || alpha <= 0) return;
  const f = clamp(focus, 0, 1);
  const rings = opts.rings ?? true;
  const outer = opts.outer ?? true;

  ctx.save();
  ctx.globalAlpha *= alpha;

  if (opts.halo !== false) {
    const halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.9);
    halo.addColorStop(0, `rgba(184,255,207,${0.05 + f * 0.07})`);
    halo.addColorStop(1, "rgba(184,255,207,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();

  const base = ctx.createLinearGradient(x, y - r, x, y + r);
  base.addColorStop(0, "#16181b");
  base.addColorStop(1, "#070708");
  ctx.fillStyle = base;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= 0.32 * (1 - f * 0.85);
  const drift = opts.drift ?? 1;
  const ox = Math.sin(t * 0.7) * r * 0.35 * drift;
  const oy = Math.cos(t * 0.55) * r * 0.35 * drift;
  // Slightly larger than the product's 2r square, so the circle stays filled.
  ctx.drawImage(NOISE, x - r * 1.25 + ox, y - r * 1.25 + oy, r * 2.5, r * 2.5);
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;

  const calm = ctx.createRadialGradient(
    x - r * 0.22,
    y - r * 0.3,
    r * 0.05,
    x,
    y,
    r * 0.98,
  );
  calm.addColorStop(0, `rgba(230,255,240,${0.07 + f * 0.24})`);
  calm.addColorStop(0.55, `rgba(184,255,207,${0.03 + f * 0.13})`);
  calm.addColorStop(1, "rgba(184,255,207,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  const shade = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  if (rings) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.strokeStyle = `rgba(235,255,242,${0.16 + f * 0.34})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  if (outer) {
    ring(x, y, r + Math.max(16, r * 0.12), "rgba(242,242,239,0.08)", 2);
  }
  ctx.restore();
}

function progressRing(x, y, r, p, alpha = 1, opts = {}) {
  const f = clamp(p, 0, 1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ring(x, y, r, "rgba(242,242,239,0.1)", opts.width ?? 2.2);
  if (f > 0.001) {
    const start = -Math.PI / 2;
    const end = start + TAU * f;
    ctx.beginPath();
    ctx.arc(x, y, r, start, end);
    ctx.strokeStyle = opts.color ?? "rgba(184,255,207,0.9)";
    ctx.lineWidth = (opts.width ?? 2.2) + 0.2;
    ctx.lineCap = "round";
    ctx.stroke();
    const tx = x + Math.cos(end) * r;
    const ty = y + Math.sin(end) * r;
    dot(tx, ty, 3.2, opts.tip ?? "#eafff1", 1, 14);
  }
  ctx.restore();
}

function keycap(x, y, w, h, press, alpha = 1) {
  const p = clamp(press, 0, 1);
  const drop = p * 7;
  ctx.save();
  ctx.globalAlpha *= alpha;

  // well
  rrect(x, y + h * 0.16, w, h * 0.84, 18);
  ctx.fillStyle = "rgba(5,6,9,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(244,241,234,0.07)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // glow under the cap
  if (p > 0.01) {
    glow(x + w / 2, y + h * 0.55, w * 0.62, C.mint, 0.12 * p);
  }

  // cap
  const cx = x + 7;
  const cy = y + 2 + drop;
  const cw = w - 14;
  const ch = h * 0.8;
  const cap = ctx.createLinearGradient(cx, cy, cx, cy + ch);
  cap.addColorStop(0, p > 0.5 ? "#242a27" : "#26292d");
  cap.addColorStop(0.55, p > 0.5 ? "#141917" : "#17191c");
  cap.addColorStop(1, "#0b0c0e");
  rrect(cx, cy, cw, ch, 14);
  ctx.fillStyle = cap;
  ctx.fill();
  ctx.strokeStyle = p > 0.5 ? withAlpha(C.mint, 0.35) : "rgba(244,241,234,0.14)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // top edge
  line(cx + 10, cy + 1.5, cx + cw - 10, cy + 1.5, "rgba(244,241,234,0.16)", 1.2, null, 1);
  // inner top face
  rrect(cx + 8, cy + 8, cw - 16, ch * 0.46, 8);
  ctx.strokeStyle = "rgba(244,241,234,0.045)";
  ctx.lineWidth = 1;
  ctx.stroke();

  text("SPACE", cx + 24, cy + 36, {
    size: 13,
    family: F.mono,
    color: "rgba(244,241,234,0.5)",
    ls: 3,
  });
  text("hold to focus", cx + 24, cy + 74, {
    size: 23,
    weight: 500,
    color: p > 0.5 ? C.ink : "rgba(244,241,234,0.9)",
  });

  // led
  const ledX = cx + cw - 24;
  const ledY = cy + 30;
  dot(ledX, ledY, 3.6, p > 0.5 ? C.mint : "rgba(184,255,207,0.7)", 1, p > 0.5 ? 16 : 8);

  ctx.restore();
}

function accentLine(prefix, accent, suffix, x, y, opts = {}) {
  const { size = 56, weight = 500, alpha = 1, accentColor = C.mint, color = C.ink } = opts;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  font(size, weight, F.sans);
  ctx.letterSpacing = "0px";
  const pw = ctx.measureText(prefix).width;
  const aw = ctx.measureText(accent).width;
  ctx.fillStyle = color;
  ctx.fillText(prefix, x, y);
  ctx.fillStyle = accentColor;
  ctx.fillText(accent, x + pw, y);
  if (suffix) {
    ctx.fillStyle = color;
    ctx.fillText(suffix, x + pw + aw, y);
  }
  ctx.restore();
}

function copyBand(p) {
  return p < 0.34 ? 0 : p < 0.7 ? 1 : 2;
}

function stateNode(x, y, w, h, name, sub, active, alpha = 1) {
  const on = clamp(active, 0, 1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  panel(x, y, w, h, {
    r: 16,
    fill: on > 0.4 ? "rgba(20,34,31,0.92)" : "rgba(10,14,28,0.66)",
    stroke: on > 0.4 ? withAlpha(C.mint, 0.65) : "rgba(244,241,234,0.13)",
    lw: 1.4,
    glow: on > 0.4 ? withAlpha(C.mint, 0.35 * on) : null,
  });
  dot(x + 26, y + h / 2, 5, on > 0.4 ? C.mint : C.faint, 1, on > 0.4 ? 10 : 0);
  text(name, x + 48, y + h / 2 + 5, {
    size: 22,
    family: F.mono,
    color: on > 0.4 ? C.ink : C.dim,
    ls: 2.4,
  });
  if (sub) {
    mono(sub, x + w - 20, y + h / 2 + 5, {
      size: 12,
      color: on > 0.4 ? withAlpha(C.mint, 0.8) : C.faint,
      align: "right",
      ls: 1,
    });
  }
  ctx.restore();
  return on;
}

function statCard(x, y, w, h, value, unit, note, alpha = 1, accent = C.mint) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  panel(x, y, w, h, {
    r: 14,
    fill: "rgba(8,12,24,0.72)",
    stroke: withAlpha(accent, 0.18),
  });
  text(value, x + 22, y + 62, {
    size: 46,
    family: F.mono,
    color: accent,
    weight: 500,
  });
  mono(unit, x + 22 + ctx.measureText(value).width + 10, y + 60, {
    size: 13,
    color: C.dim,
    ls: 1,
  });
  label(note, x + 22, y + h - 18, { size: 12, color: C.dim });
  ctx.restore();
}

// 01 cold open

function intro(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 1.2);
  const t2 = at(s, 1, 6.7);
  const t3 = at(s, 2, 13.1);
  const t4 = at(s, 3, 17.7);

  const ix = 790;
  const iy = 170;
  const iw = 1030;
  const ih = 644;

  const imgP = easeOut(span(lt, 0.35, 1.8));
  if (imgP > 0) {
    glow(ix + iw / 2, iy + ih / 2, 640, C.mint, 0.09 * imgP);
    panel(ix - 10, iy - 10, iw + 20, ih + 20, {
      r: 22,
      fill: "rgba(8,10,22,0.4)",
      stroke: "rgba(244,241,234,0.14)",
      glow: withAlpha(C.mint, 0.12),
      alpha: imgP,
    });
    image("heroIdle", ix, iy, iw, ih, imgP, 14, 1 + (1 - imgP) * 0.02);
  }

  // left column
  const lineP = (t) => smooth(span(lt, t, t + 0.9));

  text("A FOCUS INSTRUMENT", 110, 235, {
    size: 14,
    family: F.mono,
    color: C.mint,
    ls: 3.4,
    alpha: lineP(t1 - 0.3),
  });
  dot(99, 230, 3.4, C.mint, lineP(t1 - 0.3), 10);

  const openOut = 1 - smooth(span(lt, t4 - 0.4, t4 + 0.15));
  revealText("This page", 110, 340, lineP(t1), {
    size: 72,
    weight: 500,
    color: C.ink,
    alpha: openOut,
  });
  revealText("is loud.", 110, 412, lineP(t1 + 0.15), {
    size: 72,
    weight: 500,
    color: C.ink,
    alpha: openOut,
  });

  const subP = lineP(t1 + 1.3) * openOut;
  text("Not with sound.", 110, 490, {
    size: 26,
    weight: 400,
    color: C.dim,
    alpha: subP,
  });
  text("With other people's urgency.", 110, 526, {
    size: 26,
    weight: 400,
    family: F.serif,
    style: "italic",
    color: C.mint,
    alpha: subP,
  });

  const fieldP = lineP(t2 + 0.1) * (1 - smooth(span(lt, t4 - 0.3, t4 + 0.4)) * 0.55);
  if (fieldP > 0) {
    label("EIGHT SMALL PULLS", 110, 610, { size: 12, alpha: fieldP, color: C.coral });
    text("eight orbits, eight speeds", 110, 640, {
      size: 20,
      color: C.dim,
      alpha: fieldP,
    });

    // ellipse around the notification field in the screenshot
    const cx = ix + 720 * (iw / 1440);
    const cy = iy + 545 * (ih / 900);
    ctx.save();
    ctx.globalAlpha *= fieldP;
    ctx.strokeStyle = withAlpha(C.coral, 0.38);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 10]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 310, 190, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    dot(cx - 310, cy, 3, C.coral, fieldP, 8);
  }

  const holdP = lineP(t3 + 0.1);
  if (holdP > 0) {
    label("ONE CONTROL", 110, 725, { size: 12, alpha: holdP, color: C.mint });
    mono("12.0", 110, 800, {
      size: 62,
      color: C.ink,
      alpha: holdP,
    });
    label("SECONDS", 110, 836, { size: 12, alpha: holdP });

    const kx = ix + 600 * (iw / 1440);
    const ky = iy + 765 * (ih / 900);
    const kw = 240 * (iw / 1440);
    const kh = 73 * (ih / 900);
    rrect(kx - 10, ky - 8, kw + 20, kh + 16, 12);
    ctx.strokeStyle = withAlpha(C.mint, 0.55);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    dot(kx + kw / 2, ky - 24, 3, C.mint, holdP, 10);
    line(kx + kw / 2, ky - 22, kx + kw / 2, ky - 4, withAlpha(C.mint, 0.45), 1, null, holdP);
  }

  const nameP = lineP(t4 + 0.05);
  if (nameP > 0) {
    revealText("Hush.", 110, 350, nameP, {
      size: 96,
      weight: 500,
      color: C.ink,
    });
    text("the whole product", 110, 418, {
      size: 28,
      weight: 400,
      color: C.dim,
      alpha: nameP,
    });
    text("is the hold.", 110, 452, {
      size: 40,
      weight: 400,
      family: F.serif,
      style: "italic",
      color: C.mint,
      alpha: nameP,
    });
  }
}

// 02 the noise

function noise(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 7.1);
  const t3 = at(s, 2, 13.0);

  const cx = 960;
  const cy = 540;
  const rx = 580;
  const ry = 292;

  const ringP = smooth(span(lt, t1 - 0.2, t1 + 1.2));
  ring(cx, cy, 170, "rgba(244,241,234,0.08)", 1.2, ringP, [3, 9]);
  ctx.save();
  ctx.globalAlpha *= ringP;
  ctx.strokeStyle = "rgba(244,241,234,0.055)";
  ctx.setLineDash([2, 10]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // the orb, unresolved
  drawNoiseOrb(cx, cy, 150, 0, lt, 1, { drift: 1 });

  const chipP = smooth(span(lt, t1 + 0.15, t1 + 1.7));
  const dim = 1 - 0.55 * smooth(span(lt, t3 - 0.3, t3 + 0.5));

  CHIPS.forEach((chip, i) => {
    const appear = easeOut(span(lt, t1 + 0.1 + i * 0.09, t1 + 0.8 + i * 0.09));
    if (appear <= 0) return;
    const orbit = chip.angle + lt * chip.speed;
    const x = cx + Math.cos(orbit) * rx;
    const y = cy + Math.sin(orbit) * ry;
    const dist = Math.hypot(x - cx, y - cy);

    // tether: the small pull
    const tetherP = appear * (0.4 + 0.6 * smooth(span(lt, t2 - 0.5, t2 + 0.8)));
    line(cx + ((x - cx) / dist) * 162, cy + ((y - cy) / dist) * 162, x, y, withAlpha(C.coral, 0.22), 1.1, [3, 8], tetherP * dim);
    dot(cx + ((x - cx) / dist) * 162, cy + ((y - cy) / dist) * 162, 2, C.coral, tetherP * 0.7);

    // trail
    for (let k = 1; k <= 7; k++) {
      const a = orbit - k * 0.028 * chip.speed * 12;
      const px = cx + Math.cos(a) * rx;
      const py = cy + Math.sin(a) * ry;
      dot(px, py, 2.1 - k * 0.16, C.coral, (1 - k / 8) * 0.22 * appear * dim);
    }

    drawChip(x, y, chip, { alpha: appear * dim, scale: 1 });
  });

  // headline
  revealText("A field,", 110, 190, smooth(span(lt, t2 - 0.1, t2 + 0.8)), {
    size: 48,
    weight: 500,
    color: C.ink,
  });
  revealText("not a list.", 110, 244, smooth(span(lt, t2 + 0.15, t2 + 1.0)), {
    size: 48,
    weight: 500,
    family: F.serif,
    style: "italic",
    color: C.peach,
  });

  const footP = smooth(span(lt, t2 + 0.7, t2 + 1.5));
  if (footP > 0) {
    minor("8 CHIPS", 110, 930, { alpha: footP, color: C.dim });
    minor("8 SPEEDS", 250, 930, { alpha: footP, color: C.dim });
    minor("1 ORB", 400, 930, { alpha: footP, color: C.dim });
    line(500, 924, 700, 924, withAlpha(C.coral, 0.3), 1, [2, 6], footP);
    mono("none of them line up", 720, 930, {
      size: 15,
      color: withAlpha(C.coral, 0.75),
      alpha: footP,
      ls: 1,
    });
  }

  // the orb takes over the last beat
  const orbP = smooth(span(lt, t3 - 0.2, t3 + 0.7));
  if (orbP > 0) {
    ring(cx, cy, 178 + Math.sin(lt * 1.2) * 3, withAlpha(C.mint, 0.16), 1.1, orbP, [4, 8]);
    line(cx, cy + 172, cx, 760, withAlpha(C.mint, 0.3), 1, [3, 6], orbP);
    text("random grey, going nowhere", cx, 790, {
      size: 19,
      family: F.mono,
      color: withAlpha(C.mint, 0.8),
      align: "center",
      alpha: orbP,
    });
  }
}

// 03 one gesture

function gesture(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 3.9);
  const t3 = at(s, 2, 9.6);

  const kx = 180;
  const ky = 430;
  const kw = 430;
  const kh = 180;

  const pressStart = t3 + 0.35;
  const pressEnd = t3 + 3.4;
  const press = smooth(span(lt, pressStart, pressStart + 0.18)) * (1 - smooth(span(lt, pressEnd, pressEnd + 0.28)));
  const held = clamp((lt - pressStart) / 1, 0, 1) * (lt > pressStart ? 1 : 0);
  const count = clamp(lt - pressStart, 0, pressEnd - pressStart);
  const pressed = lt >= pressStart && lt <= pressEnd;

  keycap(kx, ky, kw, 150, press, smooth(span(lt, t1 - 0.1, t1 + 0.8)));

  // input paths
  const pathP = smooth(span(lt, t2 - 0.1, t2 + 0.8));
  if (pathP > 0) {
    // keyboard
    panel(170, 250, 250, 72, {
      r: 12,
      fill: "rgba(10,14,28,0.72)",
      stroke: "rgba(244,241,234,0.12)",
      alpha: pathP,
    });
    text("KEYBOARD", 190, 278, { size: 11, family: F.mono, color: C.dim, ls: 2, alpha: pathP });
    text("Space / Enter", 190, 304, { size: 18, color: C.ink, alpha: pathP });

    panel(460, 250, 250, 72, {
      r: 12,
      fill: "rgba(10,14,28,0.72)",
      stroke: "rgba(244,241,234,0.12)",
      alpha: pathP,
    });
    text("POINTER", 480, 278, { size: 11, family: F.mono, color: C.dim, ls: 2, alpha: pathP });
    text("press and hold", 480, 304, { size: 18, color: C.ink, alpha: pathP });

    arrow(295, 326, 350, 410, withAlpha(C.mint, 0.45), 1.3, 7, pathP);
    arrow(585, 326, 470, 410, withAlpha(C.mint, 0.45), 1.3, 7, pathP);
  }

  // hold bar
  const barP = smooth(span(lt, t2 + 0.3, t2 + 1));
  if (barP > 0) {
    const bx = 180;
    const by = 660;
    const bw = 530;
    rrect(bx, by, bw, 8, 4);
    ctx.fillStyle = "rgba(244,241,234,0.08)";
    ctx.fill();
    const fill = pressed ? clamp(count / 4, 0, 1) : pressEnd > 0 && lt > pressEnd ? clamp((pressEnd - pressStart) / 4, 0, 1) : 0;
    if (fill > 0) {
      rrect(bx, by, bw * fill, 8, 4);
      ctx.fillStyle = withAlpha(C.mint, 0.85);
      ctx.fill();
    }
    mono(`${count.toFixed(1)}`, 180, 715, {
      size: 38,
      color: pressed ? C.ink : C.dim,
      alpha: barP,
    });
    mono(pressed ? "counting" : lt > pressEnd && pressEnd > 0 ? "stopped" : "12.0 s to fill",
      262, 712, { size: 14, color: pressed ? C.mint : C.dim, alpha: barP, ls: 1.4 });
    line(180, 735, 710, 735, "rgba(244,241,234,0.08)", 1, null, barP);
  }

  // state machine
  const stateP = smooth(span(lt, t1 + 0.2, t1 + 1));
  if (stateP > 0) {
    const sx = 1160;
    const sw = 390;
    const sh = 96;
    const y1 = 270;
    const y2 = 470;
    const y3 = 670;
    const focus = lt >= pressStart && lt <= pressEnd ? 1 : 0;
    const idle = lt < pressStart || lt > pressEnd ? 1 : 0;
    const done = lt > pressEnd + 2 ? 0 : 0;

    stateNode(sx, y1, sw, sh, "IDLE", "waiting", idle * stateP, stateP);
    stateNode(sx, y2, sw, sh, "FOCUSING", "counting", focus * stateP, stateP);
    stateNode(sx, y3, sw, sh, "DONE", "quiet", done * stateP, stateP);

    arrow(sx + sw / 2, y1 + sh + 8, sx + sw / 2, y2 - 8, withAlpha(C.mint, 0.35), 1.3, 8, stateP);
    text("press", sx + sw / 2 + 14, y1 + sh + 30, { size: 12, family: F.mono, color: C.dim, alpha: stateP });
    arrow(sx + sw / 2, y2 + sh + 8, sx + sw / 2, y3 - 8, withAlpha(C.mint, 0.22), 1.3, 8, stateP);
    text("12.0 s", sx + sw / 2 + 14, y2 + sh + 30, { size: 12, family: F.mono, color: C.faint, alpha: stateP });

    // release curve back to idle
    const releaseA = smooth(span(lt, pressStart + 0.3, pressStart + 0.7)) *
      (1 - smooth(span(lt, pressEnd + 0.5, pressEnd + 1.0)));
    if (releaseA > 0) {
      ctx.save();
      ctx.globalAlpha *= stateP * releaseA;
      ctx.strokeStyle = withAlpha(C.coral, 0.55);
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(sx - 8, y2 + sh / 2);
      ctx.bezierCurveTo(sx - 120, y2 + sh / 2, sx - 120, y1 + sh / 2, sx - 8, y1 + sh / 2);
      ctx.stroke();
      ctx.restore();
      arrow(sx - 30, y1 + sh / 2 + 10, sx - 10, y1 + sh / 2, withAlpha(C.coral, 0.5), 1.2, 7, stateP * releaseA);
      text("let go", sx - 132, y1 + sh / 2 - 12, { size: 12, family: F.mono, color: withAlpha(C.coral, 0.8), alpha: stateP * releaseA });
    }
  }

  // one gesture
  const oneP = smooth(span(lt, t1 + 0.4, t1 + 1.2));
  if (oneP > 0) {
    label("ONE GESTURE", 180, 200, { size: 12, color: C.mint, alpha: oneP });
    text("press and hold", 180, 232, {
      size: 30,
      weight: 500,
      color: C.ink,
      alpha: oneP,
    });
  }
}

// 04 the pull

function pull(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 6.8);
  const t3 = at(s, 2, 11.3);
  const t4 = at(s, 3, 16.5);

  const p = clamp((lt - 1.1) / 18.2, 0, 0.965);
  const cx = 960;
  const cy = 500;
  const rx = 500;
  const ry = 248;

  // progress readout
  const topP = smooth(span(lt, t1, t1 + 0.8));
  label("THE PULL", 110, 190, { size: 12, color: C.mint, alpha: topP });
  text("one number, everything moves", 110, 226, {
    size: 28,
    weight: 500,
    color: C.ink,
    alpha: topP,
  });
  mono(`p  ${p.toFixed(3)}`, 1810, 220, {
    size: 34,
    color: C.mint,
    align: "right",
    alpha: topP,
  });
  line(110, 250, 1810, 250, "rgba(244,241,234,0.08)", 1, null, topP);

  // orbit guides
  const guideP = smooth(span(lt, t1 + 0.2, t1 + 1));
  ctx.save();
  ctx.globalAlpha *= guideP;
  ctx.strokeStyle = "rgba(244,241,234,0.075)";
  ctx.setLineDash([2, 10]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(244,241,234,0.035)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();

  drawNoiseOrb(cx, cy, 132, 0.15 + p * 0.8, lt, 0.95, { drift: 0.7 });

  // trails and chips
  CHIPS.forEach((chip, i) => {
    const q = chipAt(chip, p, lt, cx, cy, rx, ry);
    const trailP = smooth(span(lt, t1 + 0.3 + i * 0.05, t1 + 1.2 + i * 0.05));
    if (trailP <= 0) return;

    for (let k = 20; k >= 1; k--) {
      const pp = Math.max(0, p - k * 0.009);
      const qq = chipAt(chip, pp, lt - k * 0.018, cx, cy, rx, ry);
      const a = (1 - k / 21) * 0.32 * trailP;
      dot(qq.x, qq.y, 2.4 - k * 0.05, C.coral, a);
    }

    // tether
    const d = Math.hypot(q.x - cx, q.y - cy) || 1;
    line(
      cx + ((q.x - cx) / d) * 140,
      cy + ((q.y - cy) / d) * 140,
      q.x,
      q.y,
      withAlpha(C.coral, 0.1),
      1,
      [2, 6],
      trailP,
    );

    drawChip(q.x, q.y, chip, {
      scale: q.scale,
      alpha: trailP * (0.9 - q.pull * 0.25),
      accent: q.pull > 0.55 ? C.mint : null,
      glowAmount: q.pull > 0.7 ? 0.7 : 0,
    });
  });

  // live readout for the first chip
  const hero = CHIPS[0];
  const hq = chipAt(hero, p, lt, cx, cy, rx, ry);
  const annP = smooth(span(lt, t3 - 0.1, t3 + 0.6)) * (1 - smooth(span(lt, t4 + 0.4, t4 + 1.0)));
  if (annP > 0 && hq.pull > 0.05) {
    panel(110, 288, 286, 146, {
      r: 14,
      fill: "rgba(8,12,24,0.78)",
      stroke: withAlpha(C.mint, 0.18),
      alpha: annP,
    });
    dot(134, 316, 4, C.mint, annP, 8);
    mono("ONE CHIP · EMAIL", 148, 320, { size: 11, color: C.dim, alpha: annP, ls: 2 });
    mono(`pull  ${hq.pull.toFixed(2)}`, 132, 362, { size: 18, color: C.mint, alpha: annP });
    mono(`scale ${hq.scale.toFixed(2)}`, 132, 392, { size: 18, color: C.peach, alpha: annP });
    mono("delay 0.00", 132, 418, { size: 11, color: C.faint, alpha: annP, ls: 1 });
  }

  // delay ticks
  const delayP = smooth(span(lt, t2 - 0.1, t2 + 0.7));
  if (delayP > 0) {
    const dx = 1350;
    const dy = 880;
    const dw = 460;
    label("DELAY, PER CHIP", dx, dy - 34, { size: 11, color: C.peach, alpha: delayP });
    line(dx, dy, dx + dw, dy, "rgba(244,241,234,0.14)", 1, null, delayP);
    CHIPS.forEach((chip) => {
      const tx = dx + (chip.delay / 0.45) * dw;
      const lit = p > chip.delay ? 1 : 0.35;
      line(tx, dy - 12, tx, dy + 12, withAlpha(C.peach, 0.35 + lit * 0.5), 2, null, delayP);
      dot(tx, dy, 3, C.peach, delayP * lit);
    });
    mono("0", dx, dy + 34, { size: 11, color: C.faint, alpha: delayP });
    mono("0.45", dx + dw, dy + 34, { size: 11, color: C.faint, align: "right", alpha: delayP });
    mono("arrives in waves", dx, dy + 62, {
      size: 13,
      color: withAlpha(C.peach, 0.8),
      alpha: delayP,
    });
  }

  // formula strip
  const formP = smooth(span(lt, t1 + 0.6, t1 + 1.4));
  if (formP > 0) {
    const fx = 610;
    const fy = 872;
    panel(fx, fy, 660, 118, {
      r: 12,
      fill: "rgba(8,12,24,0.78)",
      stroke: "rgba(244,241,234,0.09)",
      alpha: formP,
    });
    mono("local = (p - delay) / (1 - delay)", fx + 22, fy + 34, {
      size: 15,
      color: withAlpha(C.coral, 0.9),
      alpha: formP,
    });
    mono("pull  = smoothstep(local)", fx + 22, fy + 60, {
      size: 15,
      color: withAlpha(C.mint, 0.9),
      alpha: formP,
    });
    mono("scale = 1 - pull * 0.88", fx + 22, fy + 86, {
      size: 15,
      color: withAlpha(C.peach, 0.9),
      alpha: formP,
    });

    // vertical progress bar
    const px = 540;
    const py = 850;
    const ph = 150;
    mono("p", px - 18, py + 6, { size: 16, color: C.dim, alpha: formP });
    rrect(px, py, 12, ph, 6);
    ctx.fillStyle = "rgba(244,241,234,0.13)";
    ctx.fill();
    rrect(px, py + ph * (1 - p), 12, Math.max(2, ph * p), 6);
    ctx.fillStyle = withAlpha(C.mint, 0.82);
    ctx.fill();
    dot(px + 6, py + ph * (1 - p), 4.5, C.mint, formP, 12);
    mono("1", px + 22, py + 12, { size: 10, color: C.faint, alpha: formP });
    mono("0", px + 22, py + ph, { size: 10, color: C.faint, alpha: formP });
  }

  // final beat: the spiral
  const inwardP = smooth(span(lt, t4 - 0.2, t4 + 0.9));
  if (inwardP > 0) {
    text("drawn inward,", 110, 780, {
      size: 38,
      weight: 500,
      color: C.ink,
      alpha: inwardP,
    });
    text("not deleted.", 110, 822, {
      size: 38,
      weight: 500,
      family: F.serif,
      style: "italic",
      color: C.mint,
      alpha: inwardP,
    });
  }
}

// 05 it comes back

function returnScene(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 6.2);
  const t3 = at(s, 2, 11.7);
  const t4 = at(s, 3, 14.8);

  const cx = 620;
  const cy = 540;
  const rx = 450;
  const ry = 300;
  const absorbAt = t1 + 4.0;
  const spawnAt = absorbAt + 1.6;

  drawNoiseOrb(cx, cy, 200, 0.62, lt, 1, { drift: 0.8 });

  // the doomed chip
  const q = clamp((lt - t1) / (absorbAt - t1), 0, 1);
  const orbit = 0.2 + q * 2.5;
  const scale = 1 - smooth(q) * 0.86;
  const chipX = cx + Math.cos(orbit) * rx * scale;
  const chipY = cy + Math.sin(orbit) * ry * scale;
  const beforeP = 1 - smooth(span(lt, absorbAt - 0.05, absorbAt + 0.18));
  if (lt < absorbAt + 0.2) {
    for (let k = 1; k <= 10; k++) {
      const qq = Math.max(0, q - k * 0.035);
      const o = 0.2 + qq * 2.5;
      const ss = 1 - smooth(qq) * 0.86;
      dot(cx + Math.cos(o) * rx * ss, cy + Math.sin(o) * ry * ss, 2.4, C.coral, (1 - k / 11) * 0.3 * beforeP);
    }
    drawChip(chipX, chipY, CHIPS[2], {
      scale,
      alpha: beforeP * smooth(span(lt, t1 - 0.2, t1 + 0.5)),
      accent: q > 0.6 ? C.mint : null,
    });
  }

  // absorption burst
  const bp = (lt - absorbAt) / 2.0;
  if (bp > 0 && bp < 1) {
    const fade = 1 - bp;
    const bright = Math.min(1, fade * 1.5);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.4 + Math.sin(i * 7.3) * 0.2;
      const speed = 46 + (i % 5) * 14 + Math.sin(i * 3.1) * 12;
      const travel = (1 - Math.pow(1 - bp, 2.2)) * 120;
      const px = cx + Math.cos(a) * (speed + travel) * 0.6;
      const py = cy + Math.sin(a) * (speed + travel) * 0.6 * 0.8;
      dot(px, py, 3.2 * fade + 1.3, C.mint, bright * 0.95, 10);
      line(
        cx + Math.cos(a) * (speed * 0.6),
        cy + Math.sin(a) * (speed * 0.6) * 0.8,
        px,
        py,
        withAlpha(C.mint, 0.3 * fade),
        1.2,
        null,
        fade,
      );
    }
    ring(cx, cy, 200 + bp * 130, withAlpha(C.mint, 0.4 * fade), 1.4, 1);
  }

  // threshold callout
  const thP = smooth(span(lt, t1 + 0.4, t1 + 1)) * (1 - smooth(span(lt, t2 + 1.2, t2 + 1.8)));
  if (thP > 0) {
    ring(cx, cy, 200 * 1.25, withAlpha(C.mint, 0.22), 1, thP, [4, 8]);
    line(cx + 220, cy - 180, cx + 320, cy - 240, withAlpha(C.mint, 0.35), 1, [3, 5], thP);
    mono("local > 0.9", cx + 326, cy - 252, { size: 13, color: C.mint, alpha: thP, ls: 1 });
    mono("distance < 1.25 r", cx + 326, cy - 230, { size: 13, color: C.dim, alpha: thP, ls: 1 });
  }

  // new chip arrives
  const newP = smooth(span(lt, spawnAt, spawnAt + 0.8));
  if (newP > 0) {
    const a2 = 2.5 + lt * 0.12;
    const nx = cx + Math.cos(a2) * rx;
    const ny = cy + Math.sin(a2) * ry;
    for (let k = 1; k <= 6; k++) {
      dot(
        cx + Math.cos(a2 - k * 0.03) * rx,
        cy + Math.sin(a2 - k * 0.03) * ry,
        2,
        C.coral,
        (1 - k / 7) * 0.25 * newP,
      );
    }
    drawChip(nx, ny, CHIPS[0], { alpha: newP * 0.95, scale: 0.96 });
    ring(nx, ny, 52, withAlpha(C.mint, 0.35), 1, newP * (1 - smooth(span(lt, spawnAt + 0.6, spawnAt + 1.4))));
    mono("respawn 1.2–2.8 s", nx + 16, ny + 44, {
      size: 12,
      color: withAlpha(C.mint, 0.8),
      alpha: newP,
      ls: 1,
    });
  }

  // chime card
  const chimeP = smooth(span(lt, absorbAt - 0.2, absorbAt + 0.6));
  if (chimeP > 0) {
    const x = 1190;
    const y = 210;
    const w = 600;
    const h = 250;
    panel(x, y, w, h, {
      r: 16,
      fill: "rgba(8,12,24,0.78)",
      stroke: withAlpha(C.peach, 0.22),
      alpha: chimeP,
    });
    label("CHIME", x + 22, y + 34, { size: 12, color: C.peach, alpha: chimeP });
    mono("C5  D5  E5  G5  A5", x + 22, y + 70, {
      size: 15,
      color: C.ink,
      alpha: chimeP,
      ls: 2,
    });

    const lx = x + 34;
    const rx2 = x + w - 34;
    const ly = y + 150;
    line(lx, ly, rx2, ly, "rgba(244,241,234,0.16)", 1, null, chimeP);
    mono("L", lx, ly + 26, { size: 12, color: C.faint, alpha: chimeP });
    mono("R", rx2, ly + 26, { size: 12, color: C.faint, align: "right", alpha: chimeP });
    line((lx + rx2) / 2, ly - 10, (lx + rx2) / 2, ly + 10, withAlpha(C.peach, 0.25), 1, null, chimeP);

    const noteXs = [0.16, 0.32, 0.48, 0.64, 0.8];
    noteXs.forEach((f) => {
      const px = lerp(lx, rx2, f);
      dot(px, ly, 2, withAlpha(C.peach, 0.4), chimeP);
    });

    const absorbedOrbit = 0.2 + 2.5;
    const panner = clamp(Math.cos(absorbedOrbit) * 0.7, -0.7, 0.7);
    const panP = smooth(span(lt, absorbAt + 0.1, absorbAt + 0.9));
    const px = lerp((lx + rx2) / 2, lerp(lx, rx2, (panner + 0.7) / 1.4), panP);
    dot(px, ly, 6, C.mint, chimeP, 16);
    ring(px, ly, 16 + Math.sin(lt * 3) * 2, withAlpha(C.mint, 0.4), 1, chimeP);
    mono(`pan ${panner >= 0 ? "+" : ""}${panner.toFixed(2)}`, px, ly + 48, {
      size: 13,
      color: C.mint,
      align: "center",
      alpha: chimeP,
    });
  }

  // loop diagram
  const loopP = smooth(span(lt, t1 + 0.6, t1 + 1.4));
  if (loopP > 0) {
    const x = 1190;
    const y = 520;
    const w = 600;
    const h = 250;
    panel(x, y, w, h, {
      r: 16,
      fill: "rgba(8,12,24,0.7)",
      stroke: "rgba(244,241,234,0.1)",
      alpha: loopP,
    });
    label("ONE CHIP, ON A LOOP", x + 22, y + 34, { size: 12, color: C.dim, alpha: loopP });

    const stages = ["ORBIT", "THRESHOLD", "ABSORB", "RESPAWN"];
    const cols = 4;
    const bw = 120;
    const gap = (w - 44 - cols * bw) / (cols - 1);
    const by = y + 96;
    const activeStage = lt < absorbAt - 0.7 ? 0 : lt < absorbAt ? 1 : lt < absorbAt + 1.3 ? 2 : 3;

    stages.forEach((name, i) => {
      const bx = x + 22 + i * (bw + gap);
      const on = i === activeStage ? 1 : 0;
      rrect(bx, by, bw, 52, 10);
      ctx.fillStyle = on ? "rgba(20,50,40,0.9)" : "rgba(244,241,234,0.035)";
      ctx.fill();
      ctx.strokeStyle = on ? withAlpha(C.mint, 0.7) : "rgba(244,241,234,0.12)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
      text(name, bx + bw / 2, by + 32, {
        size: 12,
        family: F.mono,
        color: on ? C.ink : C.dim,
        align: "center",
        ls: 1.2,
      });
      if (i < cols - 1) {
        arrow(bx + bw + 4, by + 26, bx + bw + gap - 4, by + 26, "rgba(244,241,234,0.25)", 1.1, 6, loopP);
      }
    });

    // return arrow
    ctx.save();
    ctx.globalAlpha *= loopP;
    ctx.strokeStyle = withAlpha(C.mint, 0.3);
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x + 22 + 3 * (bw + gap) + bw / 2, by + 58);
    ctx.bezierCurveTo(x + w - 40, by + 96, x + 40, by + 96, x + 22 + bw / 2, by + 58);
    ctx.stroke();
    ctx.restore();
    text("the noise is not defeated once", x + 22, y + h - 22, {
      size: 13,
      family: F.mono,
      color: C.dim,
      alpha: loopP,
    });
  }

  // closing line
  const endP = smooth(span(lt, t4 - 0.1, t4 + 0.8));
  if (endP > 0) {
    text("It comes back.", 110, 920, {
      size: 40,
      weight: 500,
      color: C.ink,
      alpha: endP,
    });
    text("That is the honest part.", 370, 920, {
      size: 40,
      weight: 400,
      family: F.serif,
      style: "italic",
      color: C.mint,
      alpha: endP,
    });
  }
}

// 06 the static

function staticScene(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 2.9);
  const t3 = at(s, 2, 9.5);
  const t4 = at(s, 3, 16.1);

  // the square and the clip
  const sq = 360;
  const sx = 190;
  const sy = 250;
  const ccx = sx + sq / 2;
  const ccy = sy + sq / 2;
  const cr = 164;

  const sqP = smooth(span(lt, t2 - 0.1, t2 + 0.9));
  if (sqP > 0) {
    const driftX = Math.sin(lt * 0.8) * 24;
    const driftY = Math.cos(lt * 0.6) * 24;

    // raw square, outside the clip
    ctx.save();
    ctx.globalAlpha *= sqP * 0.14;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(NOISE, sx + driftX, sy + driftY, sq, sq);
    ctx.restore();

    // clipped square
    ctx.save();
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, TAU);
    ctx.clip();
    ctx.globalAlpha *= sqP;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(NOISE, sx + driftX, sy + driftY, sq, sq);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha *= sqP;
    ctx.strokeStyle = "rgba(244,241,234,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + driftX, sy + driftY, sq, sq);
    ctx.restore();

    ring(ccx, ccy, cr, withAlpha(C.mint, 0.55), 1.4, sqP, [4, 8]);
    text("256 × 256, clipped to a circle", ccx, sy + sq + 38, {
      size: 15,
      family: F.mono,
      color: C.dim,
      align: "center",
      alpha: sqP,
      ls: 1,
    });
    mono("the square drifts ±0.35 r", ccx, sy + sq + 62, {
      size: 12,
      color: C.faint,
      align: "center",
      alpha: sqP,
      ls: 1,
    });
  }

  // the split orb
  const ox = 1310;
  const oy = 450;
  const or = 230;
  const orbP = smooth(span(lt, t1 - 0.1, t1 + 1));
  if (orbP > 0) {
    glow(ox, oy, or * 1.5, C.mint, 0.07 * orbP);
    ctx.save();
    ctx.globalAlpha *= orbP;
    ctx.beginPath();
    ctx.rect(ox - or - 4, oy - or - 4, or + 4, or * 2 + 8);
    ctx.clip();
    drawNoiseOrb(ox, oy, or, 0, lt, 1, { drift: 0.8, halo: false });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha *= orbP;
    ctx.beginPath();
    ctx.rect(ox, oy - or - 4, or + 4, or * 2 + 8);
    ctx.clip();
    drawNoiseOrb(ox, oy, or, 1, lt, 1, { drift: 0.8, halo: false });
    glow(ox + or * 0.12, oy - or * 0.05, or * 0.78, C.mint, 0.12);
    ctx.restore();

    const seamP = smooth(span(lt, t1 + 0.4, t1 + 1.2));
    line(ox, oy - or - 18, ox, oy + or + 18, withAlpha(C.ink, 0.35), 1.4, null, seamP);
    ctx.save();
    ctx.globalAlpha *= seamP;
    ctx.translate(ox, oy - or - 26);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();

    text("noise", ox - 26, oy + or + 58, {
      size: 18,
      family: F.mono,
      color: C.coral,
      align: "right",
      alpha: orbP,
      ls: 2,
    });
    text("quiet", ox + 26, oy + or + 58, {
      size: 18,
      family: F.mono,
      color: C.mint,
      align: "left",
      alpha: orbP,
      ls: 2,
    });
    mono("focus 0.00 · alpha 0.32", ox - 26, oy + or + 82, {
      size: 12,
      color: C.faint,
      align: "right",
      alpha: orbP,
    });
    mono("focus 1.00 · alpha 0.048", ox + 26, oy + or + 82, {
      size: 12,
      color: C.faint,
      align: "left",
      alpha: orbP,
    });
  }

  // headline
  const headP = smooth(span(lt, t1 + 0.2, t1 + 1));
  if (headP > 0) {
    label("THE STATIC", 110, 180, { size: 12, color: C.mint, alpha: headP });
    text("The image never changes.", 110, 218, {
      size: 30,
      weight: 500,
      color: C.ink,
      alpha: headP,
    });
  }

  // alpha graph
  const gp = smooth(span(lt, t3 - 0.3, t3 + 0.9));
  if (gp > 0) {
    const gx = 110;
    const gy = 780;
    const gw = 760;
    const gh = 160;
    label("ALPHA OVER FOCUS", gx, gy - 18, { size: 11, color: C.coral, alpha: gp });
    line(gx, gy + gh, gx + gw, gy + gh, "rgba(244,241,234,0.16)", 1, null, gp);
    line(gx, gy, gx, gy + gh, "rgba(244,241,234,0.16)", 1, null, gp);
    for (let i = 1; i <= 3; i++) {
      line(gx, gy + gh - (gh * i) / 4, gx + gw, gy + gh - (gh * i) / 4, "rgba(244,241,234,0.05)", 1, null, gp);
    }
    mono("0", gx - 8, gy + gh + 18, { size: 11, color: C.faint, align: "right", alpha: gp });
    mono("1", gx + gw, gy + gh + 18, { size: 11, color: C.faint, align: "right", alpha: gp });
    mono("0.32", gx - 8, gy + 4, { size: 11, color: C.faint, align: "right", alpha: gp });
    mono("0", gx - 8, gy + gh + 2, { size: 11, color: C.faint, align: "right", alpha: gp });

    const y0 = gy + gh - (0.32 / 0.35) * gh;
    const y1 = gy + gh - (0.048 / 0.35) * gh;
    ctx.save();
    ctx.globalAlpha *= gp;
    ctx.strokeStyle = withAlpha(C.coral, 0.8);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(gx, y0);
    ctx.lineTo(gx + gw, y1);
    ctx.stroke();
    ctx.restore();
    dot(gx, y0, 4, C.coral, gp, 8);
    dot(gx + gw, y1, 4, C.mint, gp, 8);
    mono("0.048", gx + gw + 10, y1 + 4, { size: 12, color: C.mint, alpha: gp });

    const fp = clamp((lt - t3 - 0.3) / 4.5, 0, 1);
    const px = gx + gw * fp;
    const py = lerp(y0, y1, fp);
    line(px, gy, px, gy + gh, withAlpha(C.mint, 0.25), 1, [4, 6], gp);
    dot(px, py, 5, C.mint, gp, 12);
    mono(`f ${fp.toFixed(2)}`, px + 10, gy + 18, { size: 12, color: C.ink, alpha: gp });

    mono("alpha = 0.32 × (1 - 0.85 f)", 910, 840, {
      size: 15,
      color: C.dim,
      alpha: gp,
    });
    mono("at f = 1: 0.048", 910, 868, {
      size: 15,
      color: withAlpha(C.mint, 0.85),
      alpha: gp,
    });
  }

  // mint glow beat
  const mintP = smooth(span(lt, t4 - 0.2, t4 + 0.8));
  if (mintP > 0) {
    glow(ox + 40, oy + 10, or * 0.95, C.mint, 0.12 * mintP);
    ring(ox, oy, or + 18 + Math.sin(lt * 1.1) * 3, withAlpha(C.mint, 0.2), 1.2, mintP, [4, 9]);
    mono("the glow is underneath", ox, oy + or + 116, {
      size: 13,
      color: withAlpha(C.mint, 0.85),
      align: "center",
      alpha: mintP,
      ls: 1,
    });
  }
}

// 07 the clock

function clockScene(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 3.3);
  const t3 = at(s, 2, 8.8);
  const t4 = at(s, 3, 14.2);

  const p = clamp((lt - t2 + 0.2) / 12.0, 0, 0.965);
  const cx = 520;
  const cy = 520;
  const cr = 236;
  const seconds = p * HOLD;

  // clock face
  const faceP = smooth(span(lt, t1 - 0.2, t1 + 0.9));
  if (faceP > 0) {
    ring(cx, cy, cr, "rgba(242,242,239,0.08)", 2, faceP);
    for (let i = 0; i < 60; i++) {
      const a = -Math.PI / 2 + (i / 60) * TAU;
      const major = i % 5 === 0;
      const r0 = cr + 18;
      const r1 = cr + (major ? 34 : 27);
      line(
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0,
        cx + Math.cos(a) * r1,
        cy + Math.sin(a) * r1,
        major ? "rgba(244,241,234,0.28)" : "rgba(244,241,234,0.1)",
        major ? 1.4 : 1,
        null,
        faceP,
      );
    }
    for (let i = 0; i <= 12; i += 3) {
      const a = -Math.PI / 2 + (i / 12) * TAU;
      mono(String(i), cx + Math.cos(a) * (cr + 62), cy + Math.sin(a) * (cr + 62) + 5, {
        size: 12,
        color: C.faint,
        align: "center",
        alpha: faceP,
      });
    }
  }

  progressRing(cx, cy, cr, p, 1, { width: 3 });

  // readout
  const readP = smooth(span(lt, t2, t2 + 0.8));
  mono(seconds.toFixed(1), cx, cy + 20, {
    size: 82,
    color: C.ink,
    align: "center",
    alpha: readP,
  });
  label("SECONDS OF FOCUS", cx, cy + 62, {
    size: 12,
    color: C.dim,
    align: "center",
    alpha: readP,
  });
  if (p > 0.98) {
    dot(cx, cy - 74, 5, C.mint, 1, 18);
  }

  // copy stack
  const stackP = smooth(span(lt, t3 - 0.2, t3 + 0.8));
  const band = copyBand(p);
  const rows = [
    { prefix: "Stay with ", accent: "it.", sub: "The noise is thinning." },
    { prefix: "Almost ", accent: "quiet.", sub: "Keep holding." },
    { prefix: "Don't let ", accent: "go.", sub: "One more breath." },
  ];
  rows.forEach((row, i) => {
    const active = i === band;
    const y = 286 + i * 138;
    const size = active ? 54 : 34;
    const a = stackP * (active ? 1 : 0.34);
    accentLine(row.prefix, row.accent, "", 1010, y, {
      size,
      weight: 500,
      alpha: a,
      accentColor: active ? C.mint : C.faint,
      color: active ? C.ink : C.dim,
    });
    mono(row.sub, 1010, y + 30, {
      size: active ? 14 : 12,
      color: active ? withAlpha(C.mint, 0.85) : C.faint,
      alpha: stackP * (active ? 1 : 0.5),
      ls: 1,
    });
    if (active) {
      line(982, y - 40, 982, y + 40, withAlpha(C.mint, 0.5), 2, null, stackP);
    }
  });

  // timeline
  const tlP = smooth(span(lt, t3 + 0.2, t3 + 1));
  if (tlP > 0) {
    const tx = 1010;
    const ty = 686;
    const tw = 760;
    const bands = [
      { a: 0, b: 0.34, name: "STAY", color: C.mint },
      { a: 0.34, b: 0.7, name: "ALMOST", color: C.peach },
      { a: 0.7, b: 1, name: "DON'T LET GO", color: C.coral },
    ];
    label("THE TWELVE SECONDS", tx, ty - 24, { size: 11, color: C.dim, alpha: tlP });
    bands.forEach((b) => {
      const x0 = tx + b.a * tw;
      const x1 = tx + b.b * tw;
      rrect(x0, ty, x1 - x0 - 3, 10, 5);
      ctx.fillStyle = withAlpha(b.color, 0.22);
      ctx.fill();
      const fill = clamp((p - b.a) / (b.b - b.a), 0, 1);
      if (fill > 0) {
        rrect(x0, ty, (x1 - x0 - 3) * fill, 10, 5);
        ctx.fillStyle = withAlpha(b.color, 0.9);
        ctx.fill();
      }
      mono(b.name, x0, ty + 32, {
        size: 10,
        color: withAlpha(b.color, 0.8),
        alpha: tlP,
        ls: 1,
      });
    });
    const phx = tx + p * tw;
    line(phx, ty - 12, phx, ty + 22, C.ink, 1.4, null, tlP);
    mono("0.0", tx, ty + 58, { size: 11, color: C.faint, alpha: tlP });
    mono("4.1", tx + 0.34 * tw, ty + 58, { size: 11, color: C.faint, alpha: tlP });
    mono("8.4", tx + 0.7 * tw, ty + 58, { size: 11, color: C.faint, alpha: tlP });
    mono("12.0", tx + tw, ty + 58, { size: 11, color: C.faint, align: "right", alpha: tlP });
  }

  // one variable, three outputs
  const fanP = smooth(span(lt, t4 - 0.1, t4 + 0.9));
  if (fanP > 0) {
    mono("p = held / 12", 1010, 836, { size: 16, color: C.mint, alpha: fanP, ls: 1 });
    text("one variable", 1420, 836, {
      size: 26,
      family: F.serif,
      style: "italic",
      color: C.peach,
      alpha: fanP,
    });
    text("three outputs", 1420, 872, {
      size: 20,
      color: C.dim,
      alpha: fanP,
    });

    ring(cx, cy, cr + 14 + Math.sin(lt * 1.6) * 2, withAlpha(C.mint, 0.16), 1.2, fanP, [4, 10]);
    mono("RING   COPY   READOUT", 1420, 910, {
      size: 11,
      color: C.faint,
      alpha: fanP,
      ls: 2,
    });
  }
}

// 08 the leak

function leakAt(t) {
  if (t <= 7) return t / HOLD;
  if (t <= 7 + (7 / HOLD) / 0.85) return 7 / HOLD - (t - 7) * 0.85;
  if (t <= 12) return 0;
  if (t <= 24) return (t - 12) / HOLD;
  return 1;
}

function leakScene(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 3.1);
  const t3 = at(s, 2, 8.7);
  const t4 = at(s, 3, 13.8);

  const gx = 110;
  const gy = 296;
  const gw = 1030;
  const gh = 434;
  const gx2 = gx + gw;
  const gy2 = gy + gh;

  const gt = clamp((lt - 0.9) * 2.0, 0, 28);
  const px = (t) => gx + (t / 28) * gw;
  const py = (v) => gy2 - v * gh;

  // axes + grid
  const axP = smooth(span(lt, t1 - 0.2, t1 + 0.9));
  if (axP > 0) {
    for (let i = 0; i <= 4; i++) {
      line(gx, py(i / 4), gx2, py(i / 4), "rgba(244,241,234,0.055)", 1, null, axP);
      if (i < 4) {
        mono((i / 4).toFixed(2), gx - 16, py(i / 4) + 4, {
          size: 11,
          color: C.faint,
          align: "right",
          alpha: axP,
        });
      }
    }
    for (let t = 0; t <= 28; t += 4) {
      line(px(t), gy, px(t), gy2, "rgba(244,241,234,0.035)", 1, null, axP);
      mono(`${t}`, px(t), gy2 + 56, { size: 11, color: C.faint, align: "center", alpha: axP });
    }
    line(gx, gy2, gx2, gy2, "rgba(244,241,234,0.2)", 1.2, null, axP);
    line(gx, gy, gx, gy2, "rgba(244,241,234,0.2)", 1.2, null, axP);
    mono("focus", gx, gy - 22, { size: 11, color: C.faint, alpha: axP, ls: 1.6 });
    mono("seconds", gx2, gy2 + 82, { size: 11, color: C.faint, align: "right", alpha: axP, ls: 1.6 });
  }

  // the curve up to the playhead
  const pts = [];
  for (let t = 0; t <= gt; t += 0.12) {
    pts.push([px(t), py(clamp(leakAt(t), 0, 1))]);
  }
  if (gt > 0) {
    pts.push([px(gt), py(clamp(leakAt(gt), 0, 1))]);
    curve(pts, C.mint, 2.6, 0.95);
  }

  // past curve (the shape to come) faint
  const full = [];
  for (let t = 0; t <= 28; t += 0.12) full.push([px(t), py(clamp(leakAt(t), 0, 1))]);
  curve(full, "rgba(244,241,234,0.1)", 1.4, 0.8);

  // playhead
  if (gt > 0) {
    line(px(gt), gy, px(gt), gy2, withAlpha(C.ink, 0.3), 1, [3, 6]);
    dot(px(gt), py(clamp(leakAt(gt), 0, 1)), 5, C.mint, 1, 12);
  }

  // release marker
  const relP = smooth(span(lt, 3.6, 4.3));
  if (relP > 0) {
    const rx = px(7);
    const ry = py(7 / HOLD);
    dot(rx, ry, 5, C.coral, relP, 12);
    line(rx, ry, rx + 54, ry - 34, withAlpha(C.coral, 0.5), 1, [3, 5], relP);
    mono("let go", rx + 60, ry - 38, { size: 13, color: C.coral, alpha: relP, ls: 1 });
    // drain bracket
    const endX = px(7 + (7 / HOLD) / 0.85);
    line(rx, py(0) - 12, endX, py(0) - 12, withAlpha(C.coral, 0.5), 1, null, relP);
    line(rx, py(0) - 18, rx, py(0) - 6, withAlpha(C.coral, 0.5), 1, null, relP);
    line(endX, py(0) - 18, endX, py(0) - 6, withAlpha(C.coral, 0.5), 1, null, relP);
    mono("1.18 s", (rx + endX) / 2, py(0) - 26, {
      size: 12,
      color: C.coral,
      align: "center",
      alpha: relP,
    });
  }

  // full marker
  const fullP = smooth(span(lt, 11.5, 12.3));
  if (fullP > 0) {
    const fx = px(24);
    dot(fx, py(1), 5, C.mint, fullP, 14);
    mono("12.0 s", fx, py(1) - 22, {
      size: 13,
      color: C.mint,
      align: "center",
      alpha: fullP,
    });
  }

  // headline
  const headP = smooth(span(lt, t1 + 0.2, t1 + 1));
  if (headP > 0) {
    label("THE LEAK", 110, 180, { size: 12, color: C.coral, alpha: headP });
    text("Let go, and it drains.", 110, 218, {
      size: 30,
      weight: 500,
      color: C.ink,
      alpha: headP,
    });
  }

  // big comparison
  const statP = smooth(span(lt, t3 - 0.3, t3 + 0.9));
  if (statP > 0) {
    const sx = 1260;
    text("12.0", sx, 400, {
      size: 96,
      family: F.mono,
      color: C.mint,
      alpha: statP,
    });
    mono("seconds to fill", sx, 436, { size: 14, color: C.dim, alpha: statP, ls: 1.4 });
    line(sx, 476, sx + 490, 476, "rgba(244,241,234,0.1)", 1, null, statP);

    text("1.18", sx, 610, {
      size: 96,
      family: F.mono,
      color: C.coral,
      alpha: statP,
    });
    mono("seconds to empty", sx, 646, { size: 14, color: C.dim, alpha: statP, ls: 1.4 });

    const barP = smooth(span(lt, t3 + 0.4, t3 + 1.2));
    if (barP > 0) {
      rrect(sx, 700, 490 * (12 / 12), 8, 4);
      ctx.fillStyle = withAlpha(C.mint, 0.25);
      ctx.fill();
      rrect(sx, 724, 490 * (1.18 / 12), 8, 4);
      ctx.fillStyle = withAlpha(C.coral, 0.65);
      ctx.fill();
      mono("10.2×", sx + 490 * (1.18 / 12) + 14, 732, {
        size: 12,
        color: C.coral,
        alpha: barP,
        ls: 1,
      });
    }
  }

  // thesis
  const endP = smooth(span(lt, t4 - 0.1, t4 + 0.9));
  if (endP > 0) {
    ctx.save();
    ctx.globalAlpha *= 1 - endP * 0.55;
    text("", 0, 0, { size: 1, alpha: 0 });
    ctx.restore();
    text("Focus is not a state you enter.", 110, 890, {
      size: 36,
      weight: 500,
      color: C.ink,
      alpha: endP,
    });
    text("It is something you keep choosing.", 110, 936, {
      size: 36,
      weight: 400,
      family: F.serif,
      style: "italic",
      color: C.mint,
      alpha: endP,
    });
    const strikeP = smooth(span(lt, t4 + 0.4, t4 + 1.2));
    if (strikeP > 0) {
      const tx = 1520;
      const ty = 860;
      rrect(tx, ty, 74, 34, 17);
      ctx.fillStyle = "rgba(244,241,234,0.05)";
      ctx.fill();
      ctx.strokeStyle = withAlpha(C.coral, 0.4);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      dot(tx + 22, ty + 17, 11, C.faint, 1);
      line(tx + 6, ty + 32, tx + 68, ty + 2, withAlpha(C.coral, 0.8), 2, null, strikeP);
      mono("not a switch", tx + 88, ty + 24, { size: 12, color: C.faint, alpha: strikeP, ls: 1 });
    }
  }
}

// 09 the quiet

function quiet(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 4.3);
  const t3 = at(s, 2, 10.4);
  const t4 = at(s, 3, 13.2);

  const ix = 760;
  const iy = 190;
  const iw = 1060;
  const ih = 662;

  const imgP = easeOut(span(lt, t1 - 0.2, t1 + 1.4));
  if (imgP > 0) {
    const breathe = 1 + Math.sin(lt * 0.7) * 0.004;
    glow(ix + iw / 2, iy + ih / 2, 700, C.mint, 0.11 * imgP);
    panel(ix - 10, iy - 10, iw + 20, ih + 20, {
      r: 22,
      fill: "rgba(8,10,22,0.4)",
      stroke: withAlpha(C.mint, 0.18),
      glow: withAlpha(C.mint, 0.14),
      alpha: imgP,
    });
    image("heroQuiet", ix, iy, iw, ih, imgP, 14, breathe + (1 - imgP) * 0.03);
  }

  // left column
  label("THE QUIET", 110, 200, { size: 12, color: C.mint, alpha: smooth(span(lt, t1, t1 + 0.8)) });

  const countP = smooth(span(lt, t1 + 0.1, t1 + 1));
  if (countP > 0) {
    const held = clamp((lt - t1 + 0.1) / 0.8, 0, 1) * 12;
    mono(held.toFixed(1), 110, 320, {
      size: 92,
      color: C.ink,
      alpha: countP,
    });
    label("SECONDS, HELD", 110, 360, { size: 12, color: C.dim, alpha: countP });
  }

  // stats
  const statP = smooth(span(lt, t2 - 0.2, t2 + 0.8));
  if (statP > 0) {
    line(110, 410, 690, 410, "rgba(244,241,234,0.1)", 1, null, statP);
    mono("120", 110, 480, { size: 58, color: C.mint, alpha: statP });
    mono("particles", 110, 512, { size: 13, color: C.dim, alpha: statP, ls: 1.4 });
    mono("2.4 s", 400, 480, { size: 58, color: C.peach, alpha: statP });
    mono("bloom", 400, 512, { size: 13, color: C.dim, alpha: statP, ls: 1.4 });

    // chord
    label("BLOOM CHORD", 110, 582, { size: 11, color: C.peach, alpha: statP });
    const notes = ["A3", "C#4", "E4", "A4"];
    notes.forEach((n, i) => {
      const x = 110 + i * 112;
      const y = 612;
      rrect(x, y, 96, 58, 12);
      ctx.fillStyle = i === 0 ? withAlpha(C.peach, 0.14) : "rgba(244,241,234,0.04)";
      ctx.fill();
      ctx.strokeStyle = withAlpha(C.peach, i === 0 ? 0.45 : 0.18);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      mono(n, x + 48, y + 36, {
        size: 20,
        color: i === 0 ? C.ink : C.dim,
        align: "center",
        alpha: statP,
      });
    });
    text("a slow A major, one note after another", 110, 708, {
      size: 14,
      family: F.mono,
      color: C.faint,
      alpha: statP,
    });
  }

  // reduced motion card
  const rmP = smooth(span(lt, t4 - 0.3, t4 + 0.8));
  if (rmP > 0) {
    const x = 110;
    const y = 750;
    const w = 580;
    const h = 184;
    panel(x, y, w, h, {
      r: 16,
      fill: "rgba(8,12,24,0.76)",
      stroke: withAlpha(C.mint, 0.16),
      alpha: rmP,
    });
    glow(x + 86, y + h / 2, 74, C.mint, 0.09 * rmP);
    drawNoiseOrb(x + 86, y + h / 2, 48, 1, lt, rmP, { rings: true, outer: false });
    text("reduced motion", x + 160, y + 52, {
      size: 22,
      weight: 500,
      color: C.ink,
      alpha: rmP,
    });
    mono("particles off · bloom simplified", x + 160, y + 82, {
      size: 12,
      color: C.dim,
      alpha: rmP,
      ls: 1,
    });
    mono("the quiet still arrives", x + 160, y + 112, {
      size: 13,
      color: withAlpha(C.mint, 0.85),
      alpha: rmP,
      ls: 1,
    });
    // toggle
    const tx = x + w - 96;
    const ty = y + 38;
    rrect(tx, ty, 62, 28, 14);
    ctx.fillStyle = withAlpha(C.mint, 0.18);
    ctx.fill();
    ctx.strokeStyle = withAlpha(C.mint, 0.5);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    dot(tx + 44, ty + 14, 10, C.mint, 1, 10);
    mono("on", tx + 31, ty + 52, { size: 10, color: C.mint, align: "center", alpha: rmP, ls: 1 });
  }

}

// 10 one page

function close(lt, sc) {
  const s = times(sc);
  const t1 = at(s, 0, 0.9);
  const t2 = at(s, 1, 5.6);
  const t3 = at(s, 2, 12.6);
  const t4 = at(s, 3, 16.6);

  const outP = 1 - smooth(span(lt, t4 - 0.2, t4 + 0.7));
  const wordOut = 1 - smooth(span(lt, t2 - 0.3, t2 + 0.3));

  // three words / three layers
  const words = [
    { name: "TypeScript.", color: C.ink, x: 110, y: 300 },
    { name: "Canvas.", color: C.mint, x: 110, y: 400 },
    { name: "Web Audio.", color: C.peach, x: 110, y: 500 },
  ];
  const wordP = words.map((_, i) => easeOut(span(lt, t1 + i * 0.32, t1 + 0.9 + i * 0.32)));

  if (wordOut > 0) {
    words.forEach((w, i) => {
      revealText(w.name, w.x, w.y, wordP[i], {
        size: 64,
        weight: 500,
        color: w.color,
        alpha: wordOut,
      });
      dot(w.x - 16, w.y - 22, 4, i === 1 ? C.mint : i === 2 ? C.peach : C.faint, wordP[i] * wordOut, 8);
    });
    label("EVERYTHING, IN THREE LAYERS", 110, 570, {
      size: 12,
      color: C.dim,
      alpha: wordP[2] * wordOut,
    });

    const fileP = wordP[1] * wordOut;
    const fx = 790;
    const fy = 262;
    panel(fx, fy, 470, 392, {
      r: 16,
      fill: "rgba(8,12,24,0.66)",
      stroke: "rgba(244,241,234,0.1)",
      alpha: fileP,
    });
    label("THE PAGE", fx + 24, fy + 34, { size: 12, color: C.dim, alpha: fileP });
    const files = [
      ["index.html", "104"],
      ["src/main.ts", "757"],
      ["src/audio.ts", "168"],
      ["src/style.css", "688"],
    ];
    files.forEach(([name, lines], i) => {
      const yy = fy + 82 + i * 54;
      mono(name, fx + 24, yy, {
        size: 16,
        color: name.startsWith("src/") ? C.ink : C.dim,
        alpha: fileP,
      });
      mono(lines, fx + 446, yy, {
        size: 16,
        color: C.faint,
        align: "right",
        alpha: fileP,
      });
      line(fx + 24, yy + 18, fx + 446, yy + 18, "rgba(244,241,234,0.05)", 1, null, fileP);
    });
    line(fx + 24, fy + 306, fx + 446, fy + 306, "rgba(244,241,234,0.12)", 1, null, fileP);
    mono("1,717 lines", fx + 24, fy + 344, {
      size: 18,
      color: C.mint,
      alpha: fileP,
    });
    mono("4 files", fx + 446, fy + 344, {
      size: 13,
      color: C.dim,
      align: "right",
      alpha: fileP,
    });
    mono("no framework", fx + 24, fy + 372, {
      size: 12,
      color: C.faint,
      alpha: fileP,
      ls: 1,
    });
  }

  // three columns
  const cols = [
    {
      x: 150,
      header: "CANVAS 2D",
      color: C.mint,
      line1: "the orb",
      line2: "ring · particles",
      draw: (x, y, p) => {
        drawNoiseOrb(x, y, 62, 0.7, lt, p, { rings: true, outer: false });
        progressRing(x, y, 74, clamp((lt - t2) / 4, 0, 1), p, { width: 1.6 });
      },
    },
    {
      x: 735,
      header: "DOM",
      color: C.coral,
      line1: "chips · copy",
      line2: "keycap · readout",
      draw: (x, y, p) => {
        drawChip(x - 46, y - 46, CHIPS[0], { alpha: p, scale: 0.66, w: 150, h: 52 });
        drawChip(x + 38, y + 2, CHIPS[6], { alpha: p * 0.8, scale: 0.66, w: 150, h: 52 });
        drawChip(x - 26, y + 50, CHIPS[4], { alpha: p * 0.6, scale: 0.66, w: 150, h: 52 });
      },
    },
    {
      x: 1320,
      header: "WEB AUDIO",
      color: C.peach,
      line1: "three sines",
      line2: "lowpass · compressor",
      draw: (x, y, p) => {
        drawSine(x - 110, y - 54, 220, 56, lt * 0.5, C.peach, 1.6, p);
        drawSine(x - 110, y - 24, 220, 56, lt * 0.5 + 0.3, C.peach, 1, p * 0.4);
        const nodes = ["3 OSC", "LPF", "COMP"];
        nodes.forEach((n, i) => {
          const nx = x - 100 + i * 100;
          rrect(nx, y + 66, 86, 38, 8);
          ctx.fillStyle = "rgba(244,241,234,0.04)";
          ctx.fill();
          ctx.strokeStyle = withAlpha(C.peach, 0.25);
          ctx.lineWidth = 1;
          ctx.stroke();
          mono(n, nx + 43, y + 90, { size: 10, color: C.dim, align: "center", alpha: p, ls: 1 });
          if (i < 2) {
            arrow(nx + 88, y + 85, nx + 98, y + 85, withAlpha(C.peach, 0.3), 1, 5, p);
          }
        });
      },
    },
  ];

  if (outP > 0) {
    cols.forEach((col, i) => {
      const p = easeOut(span(lt, t2 + 0.05 + i * 2.0, t2 + 0.95 + i * 2.0));
      if (p <= 0) return;
      panel(col.x, 260, 440, 420, {
        r: 18,
        fill: "rgba(8,12,24,0.6)",
        stroke: withAlpha(col.color, 0.16),
        alpha: p * outP,
      });
      label(col.header, col.x + 28, 300, { size: 12, color: col.color, alpha: p * outP });
      col.draw(col.x + 220, 420, p * outP);
      text(col.line1, col.x + 28, 640, { size: 18, family: F.mono, color: C.ink, alpha: p * outP });
      text(col.line2, col.x + 28, 664, { size: 14, family: F.mono, color: C.dim, alpha: p * outP });
    });
  }

  // zero assets
  const zeroP = smooth(span(lt, t3 - 0.2, t3 + 0.8));
  if (zeroP > 0) {
    const items = [
      { name: "images", count: "0", icon: "image" },
      { name: "audio files", count: "0", icon: "audio" },
      { name: "backend", count: "0", icon: "server" },
    ];
    items.forEach((it, i) => {
      const x = 150 + i * 560;
      const y = 750;
      panel(x, y, 460, 92, {
        r: 14,
        fill: "rgba(8,12,24,0.66)",
        stroke: "rgba(244,241,234,0.1)",
        alpha: zeroP * outP,
      });
      icon(it.icon, x + 40, y + 46, 24, C.faint, zeroP * outP, 1.4);
      line(x + 26, y + 66, x + 54, y + 26, withAlpha(C.coral, 0.8), 2, null, zeroP * outP);
      text(it.name, x + 78, y + 52, {
        size: 22,
        color: C.ink,
        alpha: zeroP * outP,
      });
      mono(it.count, x + 420, y + 56, {
        size: 34,
        color: C.mint,
        align: "right",
        alpha: zeroP * outP,
      });
    });
  }

  // final keycap
  const finalP = smooth(span(lt, t4 - 0.3, t4 + 0.8));
  if (finalP > 0) {
    const kx = 730;
    const ky = 410;
    const kw = 460;
    glow(960, 500, 470, C.mint, 0.1 * finalP);
    ring(960, 500, 240 + Math.sin(lt * 0.9) * 5, withAlpha(C.mint, 0.13), 1.2, finalP, [4, 12]);
    keycap(kx, ky, kw, 170, smooth(span(lt, t4 + 0.25, t4 + 0.5)), finalP);

    revealText("Hold the key.", 960, 800, smooth(span(lt, t4 + 0.4, t4 + 1.3)), {
      size: 72,
      weight: 500,
      color: C.ink,
      align: "center",
    });
    text("That is the whole product.", 960, 852, {
      size: 34,
      family: F.serif,
      style: "italic",
      color: C.mint,
      align: "center",
      alpha: smooth(span(lt, t4 + 1.1, t4 + 1.9)),
    });
    dot(960, 892, 3, C.mint, smooth(span(lt, t4 + 1.6, t4 + 2.2)), 10);
  }
}

// export

export const SCENES = {
  intro,
  noise,
  gesture,
  pull,
  return: returnScene,
  static: staticScene,
  clock: clockScene,
  leak: leakScene,
  quiet,
  close,
  __default(t, sc) {
    header(sc.id.replace(/-/g, " "));
    text(sc.seg.title, 110, 300, { size: 64, weight: 500, color: C.ink });
  },
};
