// One-off: build transparent brand assets from the clean PFP source
// (white wordmark on flat violet). Produces:
//   public/brand/obiren-logo-{white,violet,dark}.png   (auto-cropped wordmarks)
//   public/brand/obiren-pfp.png                        (white on violet tile)
//   public/brand/obiren-mark-white.png                 (figure+star only)
//   app/icon.png + app/favicon.ico
// Usage: node scripts/process-brand-logo.cjs
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public/brand/obiren-logo-source.png");

// Brand violet of the PFP background (sampled: 118,6,253).
const KEY = { r: 118, g: 6, b: 253 };

(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  console.log("source", w, "x", h);

  // Chroma-key: alpha from violet-distance, luminance fallback for white ink.
  // Pixels near the key color -> transparent; white ink stays opaque.
  const mask = Buffer.alloc(w * h);
  let bgSum = 0;
  let bgCount = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const dr = r - KEY.r;
    const dg = g - KEY.g;
    const db = b - KEY.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    bgSum += dist;
    bgCount++;
    // Sampled bg is distance ~0; ink is far. Soft ramp keeps edges smooth.
    const a = Math.max(0, Math.min(255, Math.round(((dist - 36) * 255) / (100 - 36))));
    mask[i] = a;
  }
  const avgBgDist = bgSum / bgCount;
  console.log("avg bg distance", avgBgDist.toFixed(1));
  if (avgBgDist > 60) throw new Error("Background does not match key color; aborting");

  // Manual 3x3 box blur on the mask (sharp's blur() zeroes 1-channel raw
  // input). Removes aliasing stair-steps on curves.
  const smooth = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += mask[yy * w + xx];
          n++;
        }
      }
      smooth[y * w + x] = Math.round(sum / n);
    }
  }

  const build = (rgb) => {
    const out = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      out[i * 4] = rgb[0];
      out[i * 4 + 1] = rgb[1];
      out[i * 4 + 2] = rgb[2];
      out[i * 4 + 3] = smooth[i];
    }
    return out;
  };

  // Manual alpha-bounds trim.
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (smooth[y * w + x] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("No ink found");
  const trim = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  console.log("ink bounds", JSON.stringify(trim));

  const writeRawPng = (buf, file) =>
    sharp(buf, { raw: { width: w, height: h, channels: 4 } })
      .extract(trim)
      .png()
      .toFile(path.join(ROOT, file));

  // Full-canvas tinted layers, then trim to the ink bounding box.
  const layers = {
    white: build([255, 255, 255]),
    violet: build([109, 74, 255]),
    dark: build([28, 21, 43]),
  };
  for (const [name, buf] of Object.entries(layers)) {
    await writeRawPng(buf, `public/brand/obiren-logo-${name}.png`);
  }

  // Sanity: ink intact after trim.
  const whiteMeta = await sharp(path.join(ROOT, "public/brand/obiren-logo-white.png")).metadata();
  console.log("trimmed white", whiteMeta.width, "x", whiteMeta.height);
  if (!whiteMeta.width || whiteMeta.width >= w) throw new Error("Trim failed");

  // Figure+star mark: re-derive from the trimmed white wordmark. The figure
  // sits between the "b" bowl and the "r". Crop by ink-column analysis on
  // the center third, then clean stray specks with connected-component-ish
  // alpha thresholding per column region.
  const wm = await sharp(path.join(ROOT, "public/brand/obiren-logo-white.png"))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ww = wm.info.width;
  const wh = wm.info.height;
  const colHasInk = new Array(ww).fill(false);
  for (let x = 0; x < ww; x++) {
    let count = 0;
    for (let y = 0; y < wh; y++) if (wm.data[(y * ww + x) * 4 + 3] > 128) count++;
    colHasInk[x] = count > 2;
  }
  // Find the letter columns: contiguous ink runs. The mark is the widest
  // gap-free column range whose ink extends above the letters' x-height
  // (the star + raised arm reach near the top).
  // Simpler: find column ranges, pick the one containing the topmost ink.
  let topInkY = wh;
  for (let y = 0; y < wh; y++) {
    let found = false;
    for (let x = 0; x < ww; x++) {
      if (wm.data[(y * ww + x) * 4 + 3] > 128) { found = true; break; }
    }
    if (found) { topInkY = y; break; }
  }
  const ranges = [];
  let start = -1;
  for (let x = 0; x <= ww; x++) {
    const ink = x < ww && colHasInk[x];
    if (ink && start === -1) start = x;
    if (!ink && start !== -1) { ranges.push([start, x - 1]); start = -1; }
  }
  // The figure range = the range containing pixels in the top 25% of the image.
  let markRange = null;
  for (const [x0, x1] of ranges) {
    let touchesTop = false;
    for (let y = Math.floor(topInkY); y < topInkY + wh * 0.3 && y < wh; y++) {
      for (let x = x0; x <= x1; x++) {
        if (wm.data[(y * ww + x) * 4 + 3] > 128) { touchesTop = true; break; }
      }
      if (touchesTop) break;
    }
    if (touchesTop) { markRange = [x0, x1]; break; }
  }
  if (!markRange) throw new Error("Could not isolate figure mark");
  console.log("mark columns", markRange[0], "-", markRange[1]);

  const markBuf = await sharp(path.join(ROOT, "public/brand/obiren-logo-white.png"))
    .extract({ left: markRange[0], top: 0, width: markRange[1] - markRange[0] + 1, height: wh })
    .png()
    .toBuffer();
  // Tight vertical trim of the mark via alpha bounds.
  const mbRaw = await sharp(markBuf).raw().toBuffer({ resolveWithObject: true });
  let mMinY = mbRaw.info.height, mMaxY = -1;
  for (let y = 0; y < mbRaw.info.height; y++) {
    for (let x = 0; x < mbRaw.info.width; x++) {
      if (mbRaw.data[(y * mbRaw.info.width + x) * 4 + 3] > 8) {
        if (y < mMinY) mMinY = y;
        if (y > mMaxY) mMaxY = y;
      }
    }
  }
  await sharp(markBuf)
    .extract({ left: 0, top: mMinY, width: mbRaw.info.width, height: mMaxY - mMinY + 1 })
    .png()
    .toFile(path.join(ROOT, "public/brand/obiren-mark-white.png"));

  // Tinted marks from the same crop.
  for (const [name, rgb] of [["violet", [109, 74, 255]], ["dark", [28, 21, 43]]]) {
    const tinted = Buffer.from(markBuf);
    // Recolor RGB, keep alpha.
    const raw = await sharp(tinted).raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < raw.info.width * raw.info.height; i++) {
      raw.data[i * 4] = rgb[0];
      raw.data[i * 4 + 1] = rgb[1];
      raw.data[i * 4 + 2] = rgb[2];
    }
    await sharp(raw.data, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
      .png()
      .toFile(path.join(ROOT, `public/brand/obiren-mark-${name}.png`));
  }

  // PFP tile: white wordmark centered on the violet tile (primary logo).
  const S = 1024;
  const tileSvg = Buffer.from(
    `<svg width='${S}' height='${S}' xmlns='http://www.w3.org/2000/svg'><rect width='${S}' height='${S}' fill='#6225EB'/></svg>`,
  );
  const wordForTile = await sharp(path.join(ROOT, "public/brand/obiren-logo-white.png"))
    .resize(Math.round(S * 0.72), Math.round(S * 0.72), { fit: "inside" })
    .png()
    .toBuffer();
  const wMeta = await sharp(wordForTile).metadata();
  await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: tileSvg, left: 0, top: 0 },
      { input: wordForTile, left: Math.round((S - wMeta.width) / 2), top: Math.round((S - wMeta.height) / 2), blend: "over" },
    ])
    .png()
    .toFile(path.join(ROOT, "public/brand/obiren-pfp.png"));

  // App icon: mark centered on violet rounded square.
  const IS = 512;
  const markIcon = await sharp(path.join(ROOT, "public/brand/obiren-mark-white.png"))
    .resize(IS - 120, IS - 120, { fit: "inside" })
    .png()
    .toBuffer();
  const miMeta = await sharp(markIcon).metadata();
  const iconSvg = Buffer.from(
    `<svg width='${IS}' height='${IS}' xmlns='http://www.w3.org/2000/svg'><rect width='${IS}' height='${IS}' rx='110' fill='#6225EB'/></svg>`,
  );
  const iconPng = await sharp({ create: { width: IS, height: IS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: iconSvg, left: 0, top: 0 },
      { input: markIcon, left: Math.round((IS - miMeta.width) / 2), top: Math.round((IS - miMeta.height) / 2), blend: "over" },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(ROOT, "app/icon.png"), iconPng);

  // Favicon (PNG-in-ICO).
  const FS = 48;
  const fMark = await sharp(path.join(ROOT, "public/brand/obiren-mark-white.png"))
    .resize(FS - 12, FS - 12, { fit: "inside" })
    .png()
    .toBuffer();
  const fmMeta = await sharp(fMark).metadata();
  const fSvg = Buffer.from(
    `<svg width='${FS}' height='${FS}' xmlns='http://www.w3.org/2000/svg'><rect width='${FS}' height='${FS}' rx='10' fill='#6225EB'/></svg>`,
  );
  const fPng = await sharp({ create: { width: FS, height: FS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: fSvg, left: 0, top: 0 },
      { input: fMark, left: Math.round((FS - fmMeta.width) / 2), top: Math.round((FS - fmMeta.height) / 2), blend: "over" },
    ])
    .png()
    .toBuffer();
  const header = Buffer.from([0, 0, 1, 0, 1, 0]);
  const entry = Buffer.alloc(16);
  entry[0] = FS; entry[1] = FS; entry[2] = 0; entry[3] = 0;
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(fPng.length, 8); entry.writeUInt32LE(22, 12);
  fs.writeFileSync(path.join(ROOT, "app/favicon.ico"), Buffer.concat([header, entry, fPng]));

  console.log("done");
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
