// scripts/generate-icons.mjs
// Generates static icon files from the real AIM Studio logo (SP_Logo.jpg).
// Uses `sharp` (already installed as a Next.js dependency) for resizing.
// No new packages required.
//
// Outputs:
//   app/favicon.ico      — ICO containing 16×16 + 32×32 PNGs
//   app/icon.png         — 512×512 PNG  (Android home screen)
//   app/apple-icon.png   — 180×180 PNG  (Apple touch icon / iOS home screen)
//
// Run: node scripts/generate-icons.mjs

import sharp            from "sharp";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath }   from "url";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const root       = resolve(__dirname, "..");
const APP_DIR    = resolve(root, "app");
const LOGO_PATH  = resolve(root, "public", "images", "SP_Logo.jpg");

// Gold fill used if contain-resize ever adds padding (should never be needed
// since the source is square, but keeps the colour consistent if it is).
const GOLD_BG = { r: 201, g: 168, b: 76, alpha: 255 };

// ─── ICO builder (PNG-in-ICO, supported by all modern browsers) ──
function buildICO(entries /* Array<{ size, png: Buffer }> */) {
  const n      = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(n, 4); // image count

  let offset = 6 + 16 * n;
  const dirs = entries.map(({ size, png }) => {
    const dir = Buffer.alloc(16);
    dir[0] = size >= 256 ? 0 : size;
    dir[1] = size >= 256 ? 0 : size;
    dir[2] = 0; dir[3] = 0;
    dir.writeUInt16LE(1,  4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(offset,     12);
    offset += png.length;
    return dir;
  });

  return Buffer.concat([header, ...dirs, ...entries.map(e => e.png)]);
}

// ─── Resize helper ────────────────────────────────────────────────
async function resizeLogo(size) {
  return sharp(LOGO_PATH)
    .trim()                                        // removes white/gray background border
    .resize(size, size, {
      fit:        "contain",
      background: GOLD_BG,                         // gold padding if needed
    })
    .png()
    .toBuffer();
}

// ─── Generate ─────────────────────────────────────────────────────
console.log(`\nGenerating AIM Studio icons from: ${LOGO_PATH}\n`);

const meta = await sharp(LOGO_PATH).metadata();
console.log(`  Source: ${meta.width}×${meta.height} ${meta.format}`);

const [png16, png32, png180, png512] = await Promise.all([
  resizeLogo(16),
  resizeLogo(32),
  resizeLogo(180),
  resizeLogo(512),
]);

writeFileSync(
  resolve(APP_DIR, "favicon.ico"),
  buildICO([{ size: 16, png: png16 }, { size: 32, png: png32 }]),
);
writeFileSync(resolve(APP_DIR, "icon.png"),        png512);
writeFileSync(resolve(APP_DIR, "apple-icon.png"),  png180);

console.log("  ✓ app/favicon.ico      (16×16 + 32×32 PNG-in-ICO)");
console.log("  ✓ app/icon.png         (512×512)");
console.log("  ✓ app/apple-icon.png   (180×180)");
console.log("\nDone. Run `npm run build` to verify.\n");
