import sharp from "sharp";
import pngToIco from "png-to-ico";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets", "toolbelt-icon-master.png");

/* The master art is an opaque square; the tile's rounded corners are baked in.
   Mask to a matching rounded rect so taskbar/desktop icons get transparent
   corners instead of black nubs. */
const { width } = await sharp(source).metadata();
const radius = Math.round(width * 0.24);
const mask = Buffer.from(
  `<svg width="${width}" height="${width}"><rect x="0" y="0" width="${width}" height="${width}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
);
const masked = await sharp(source)
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();

const render = (size, file) =>
  sharp(masked).resize(size, size).png().toFile(path.join(root, file));

/* iOS home-screen icon: full-bleed opaque square (iOS applies its own corner
   rounding; transparent corners would render as black nubs). */
await sharp(source).resize(180, 180).png().toFile(path.join(root, "public", "apple-touch-icon.png"));

await render(512, "assets/icon-512.png");
await render(128, "public/toolbelt-icon-128.png");
await render(512, "assets/toolbelt-mark-512.png");
await render(256, "public/toolbelt-icon-256.png");
await render(128, "public/toolbelt-mark-128.png");

for (const size of [16, 32, 48, 128]) {
  await render(size, `extension/icon-${size}.png`);
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoBuffers = await Promise.all(
  icoSizes.map((size) => sharp(masked).resize(size, size).png().toBuffer())
);
await fs.writeFile(path.join(root, "assets", "icon.ico"), await pngToIco(icoBuffers));

/* macOS .icns. Apple's icon grid insets the rounded body inside the canvas —
   824/1024 with a 185px corner radius — so Toolbelt sits the same size in the
   Dock as every stock app instead of overflowing its neighbours. iconutil is
   macOS-only, so the Windows desktop skips this and keeps using icon.ico. */
if (process.platform === "darwin") {
  const CANVAS = 1024;
  const BODY = 824;
  const BODY_RADIUS = 185;
  const inset = Math.round((CANVAS - BODY) / 2);

  const bodyMask = Buffer.from(
    `<svg width="${BODY}" height="${BODY}"><rect x="0" y="0" width="${BODY}" height="${BODY}" rx="${BODY_RADIUS}" ry="${BODY_RADIUS}" fill="#fff"/></svg>`
  );
  const body = await sharp(source)
    .resize(BODY, BODY)
    .composite([{ input: bodyMask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const macMaster = await sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: body, top: inset, left: inset }])
    .png()
    .toBuffer();

  const iconset = path.join(root, "assets", "icon.iconset");
  await fs.rm(iconset, { recursive: true, force: true });
  await fs.mkdir(iconset, { recursive: true });
  for (const size of [16, 32, 128, 256, 512]) {
    await sharp(macMaster).resize(size, size).png().toFile(path.join(iconset, `icon_${size}x${size}.png`));
    await sharp(macMaster).resize(size * 2, size * 2).png().toFile(path.join(iconset, `icon_${size}x${size}@2x.png`));
  }
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  await promisify(execFile)("iconutil", ["-c", "icns", iconset, "-o", path.join(root, "assets", "icon.icns")]);
  await fs.rm(iconset, { recursive: true, force: true });
  console.log("Rendered assets/icon.icns (Apple 824/1024 grid).");
} else {
  console.log("Skipped assets/icon.icns (iconutil needs macOS).");
}

console.log("Rendered Toolbelt icon set from master art (masked, sizes:", [512, 256, 128, ...icoSizes].join("/"), "+ ico).");
