#!/usr/bin/env node
/**
 * Generates public/qr.png and public/qr.svg for the deployed app URL.
 *
 *   npm run qr -- https://your-app.vercel.app
 *
 * Refuses non-HTTPS and local URLs so a placeholder never ends up printed.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/generate-qr.mjs <https-url>");
  process.exit(1);
}

let url;
try {
  url = new URL(arg);
} catch {
  console.error(`Not a valid URL: ${arg}`);
  process.exit(1);
}
if (url.protocol !== "https:") {
  console.error(`URL must use HTTPS (got ${url.protocol}).`);
  process.exit(1);
}
if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.)/.test(url.hostname) || /example\.com$|your-app/.test(url.hostname)) {
  console.error(`Refusing local or placeholder host: ${url.hostname}`);
  process.exit(1);
}

const target = url.toString();
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const opts = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#050f22", light: "#ffffff" } };

await QRCode.toFile(resolve(publicDir, "qr.png"), target, { ...opts, width: 1024 });
await writeFile(resolve(publicDir, "qr.svg"), await QRCode.toString(target, { ...opts, type: "svg" }));
console.log(`QR code for ${target} written to public/qr.png and public/qr.svg`);
