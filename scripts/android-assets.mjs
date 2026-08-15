// Downloads the Wrapline icon/splash and generates Android launcher + splash resources.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const config = JSON.parse(process.env.CONFIG ?? "{}");
const iconUrl = config.icon_url;
const splashUrl = config.splash_url;

// This script already runs for every Android build, even without branding.
// Apply system-bar insets here so all newly generated APKs receive the fix.
await import("./android-insets.mjs");

if (!iconUrl && !splashUrl) {
  console.log("No custom icon or splash supplied — keeping Capacitor defaults");
  process.exit(0);
}

mkdirSync("assets", { recursive: true });

async function download(url, target) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${target}: ${response.status}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${target}`);
}

if (iconUrl) await download(iconUrl, "assets/icon.png");
if (splashUrl) await download(splashUrl, "assets/splash.png");
// @capacitor/assets needs both files; reuse whichever we have.
if (!iconUrl) await download(splashUrl, "assets/icon.png");
if (!splashUrl) await download(iconUrl, "assets/splash.png");

const background = config.theme_color ?? "#000000";
execSync(
  `npx --yes @capacitor/assets@3 generate --android --iconBackgroundColor "${background}" --splashBackgroundColor "${background}"`,
  { stdio: "inherit" },
);
console.log("Generated Android icon and splash resources");
