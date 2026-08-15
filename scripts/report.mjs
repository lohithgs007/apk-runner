// Reports status/log lines and uploads artifacts back to Wrapline (HMAC signed).
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const config = JSON.parse(process.env.CONFIG ?? "{}");
const secret = process.env.BUILD_CALLBACK_SECRET;
if (!secret) {
  console.error("BUILD_CALLBACK_SECRET is not set");
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);

async function status(state, message) {
  const body = JSON.stringify({ build_id: config.build_id, status: state, message });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const response = await fetch(config.callback_url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-build-signature": signature },
    body,
  });
  if (!response.ok) {
    console.error(`Callback failed [${response.status}]: ${await response.text()}`);
    process.exit(1);
  }
}

async function upload(filePath, kind) {
  const bytes = readFileSync(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const signature = createHmac("sha256", secret)
    .update(`${config.build_id}:${kind}:${digest}`)
    .digest("hex");
  const url = `${config.artifact_upload_url}?build_id=${config.build_id}&kind=${kind}&filename=${encodeURIComponent(basename(filePath))}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "x-build-signature": signature },
    body: bytes,
  });
  if (!response.ok) {
    console.error(`Artifact upload failed [${response.status}]: ${await response.text()}`);
    process.exit(1);
  }
  console.log(`Uploaded ${basename(filePath)} (${bytes.byteLength} bytes)`);
}

if (command === "status") {
  await status(rest[0], rest.slice(1).join(" "));
} else if (command === "log") {
  await status("running", rest.join(" "));
} else if (command === "upload") {
  await upload(rest[0], rest[1]);
} else {
  console.error("usage: report.mjs status|log|upload ...");
  process.exit(1);
}