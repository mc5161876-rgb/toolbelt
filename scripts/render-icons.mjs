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

await render(512, "assets/icon-512.png");
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

console.log("Rendered Toolbelt icon set from master art (masked, sizes:", [512, 256, 128, ...icoSizes].join("/"), "+ ico).");
