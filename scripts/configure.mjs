// Generates the Capacitor shell from the Wrapline build config.
import { mkdirSync, writeFileSync } from "node:fs";

const config = JSON.parse(process.env.CONFIG ?? "{}");

const {
  app_name: appName = "App",
  package_id: packageId = "com.example.app",
  website_url: websiteUrl,
  theme_color: themeColor = "#000000",
  orientation = "portrait",
  version_name: versionName = "1.0.0",
} = config;

if (!websiteUrl) {
  console.error("config.website_url is required");
  process.exit(1);
}

mkdirSync("www", { recursive: true });

// Fallback shell shown only if the remote site cannot be reached.
writeFileSync(
  "www/index.html",
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="${themeColor}" />
    <title>${appName}</title>
    <style>
      body { margin:0; display:grid; place-items:center; height:100vh;
        font-family: -apple-system, system-ui, sans-serif; background:${themeColor}; color:#fff; }
    </style>
  </head>
  <body><p>Connecting…</p></body>
</html>
`,
);

writeFileSync(
  "capacitor.config.json",
  JSON.stringify(
    {
      appId: packageId,
      appName,
      webDir: "www",
      server: { url: websiteUrl, cleartext: false, androidScheme: "https" },
      android: { allowMixedContent: false },
      ios: { contentInset: "always" },
      plugins: {
        SplashScreen: { backgroundColor: themeColor, launchAutoHide: true },
      },
    },
    null,
    2,
  ),
);

writeFileSync(
  "build-meta.json",
  JSON.stringify({ appName, packageId, orientation, versionName, themeColor }, null, 2),
);

console.log(`Configured ${appName} (${packageId}) -> ${websiteUrl}`);