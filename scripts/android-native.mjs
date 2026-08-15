// Applies orientation, permissions and version metadata to the generated Android project.
import { readFileSync, writeFileSync } from "node:fs";

const config = JSON.parse(process.env.CONFIG ?? "{}");
const permissions = new Set(config.permissions ?? []);
const manifestPath = "android/app/src/main/AndroidManifest.xml";
const gradlePath = "android/app/build.gradle";

const PERMISSION_LINES = {
  camera: ["android.permission.CAMERA"],
  location: ["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"],
  notifications: ["android.permission.POST_NOTIFICATIONS"],
  microphone: ["android.permission.RECORD_AUDIO"],
  storage: ["android.permission.READ_MEDIA_IMAGES"],
  contacts: ["android.permission.READ_CONTACTS"],
};

let manifest = readFileSync(manifestPath, "utf8");

const uses = [...permissions]
  .flatMap((id) => PERMISSION_LINES[id] ?? [])
  .map((name) => `    <uses-permission android:name="${name}" />`)
  .join("\n");
if (uses) manifest = manifest.replace("</manifest>", `${uses}\n</manifest>`);

const screenOrientation =
  config.orientation === "landscape"
    ? "landscape"
    : config.orientation === "any"
      ? "fullSensor"
      : "portrait";
manifest = manifest.replace(
  /android:screenOrientation="[^"]*"/,
  `android:screenOrientation="${screenOrientation}"`,
);
if (!manifest.includes("android:screenOrientation")) {
  manifest = manifest.replace(
    "<activity",
    `<activity\n            android:screenOrientation="${screenOrientation}"`,
  );
}
writeFileSync(manifestPath, manifest);

let gradle = readFileSync(gradlePath, "utf8");
gradle = gradle
  .replace(/versionCode \d+/, `versionCode ${Number(config.version_code ?? 1)}`)
  .replace(/versionName "[^"]*"/, `versionName "${config.version_name ?? "1.0.0"}"`);

if (!gradle.includes("signingConfigs")) {
  gradle = gradle.replace(
    "android {",
    `android {
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH"))
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }`,
  );
  gradle = gradle.replace(
    /buildTypes \{\s*release \{/,
    `buildTypes {
        release {
            signingConfig signingConfigs.release`,
  );
}
writeFileSync(gradlePath, gradle);

console.log(`Android project configured (${screenOrientation}, ${permissions.size} permissions)`);