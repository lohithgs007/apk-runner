// Reports status/log lines and uploads artifacts using GitHub's signed workflow identity.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const config = JSON.parse(process.env.CONFIG ?? "{}");
const [command, ...rest] = process.argv.slice(2);

async function identityToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) throw new Error("GitHub workflow identity is unavailable");
  const url = new URL(requestUrl);
  url.searchParams.set("audience", "wrapline-build-callback");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  if (!response.ok) throw new Error(`Workflow identity failed [${response.status}]`);
  return (await response.json()).value;
}

async function status(state, message) {
  const body = JSON.stringify({ build_id: config.build_id, status: state, message });
  const token = await identityToken();
  const response = await fetch(config.callback_url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
  const token = await identityToken();
  const url = `${config.artifact_upload_url}?build_id=${config.build_id}&kind=${kind}&filename=${encodeURIComponent(basename(filePath))}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", Authorization: `Bearer ${token}` },
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