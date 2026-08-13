import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "toolbelt-mark.svg");

await sharp(source).resize(512, 512).png().toFile(path.join(root, "assets", "toolbelt-mark-512.png"));

for (const size of [16, 32, 48, 128]) {
  await sharp(source)
    .resize(size, size, { fit: "fill" })
    .png()
    .toFile(path.join(root, "extension", `icon-${size}.png`));
}

console.log("Rendered crisp Toolbelt small-size icon assets.");

