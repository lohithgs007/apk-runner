# Wrapline Android runner — full setup guide

This folder is a drop-in GitHub repository that compiles your web app into a signed Android APK
and reports progress back to Wrapline. Total setup time: ~10 minutes.

You need: a GitHub account. Nothing else, no Android Studio, no local tooling.

---

## Step 1 — Create the runner repository

1. Go to <https://github.com/new>.
2. Repository name: `apk-runner` (any name works).
3. Visibility: **Public**. Public repos get unlimited free Actions minutes on Linux; private repos
   are capped at 2,000 min/month. Nothing secret is stored in this repo.
4. Do **not** tick "Add a README".
5. Click **Create repository**.

## Step 2 — Copy the runner files into it

The repo must end up with this exact layout at its root:

```text
.github/workflows/build.yml
scripts/configure.mjs
scripts/android-native.mjs
scripts/android-push.mjs
scripts/report.mjs
package.json
README.md
```

Easiest path (GitHub web UI, no git needed):

1. Download this project's code (Lovable → top-right **⋯** → Download / or GitHub export).
2. Open the `runner/` folder on your computer.
3. In the empty GitHub repo click **uploading an existing file**.
4. Drag in `package.json`, `README.md` and the `scripts` folder.
5. GitHub's uploader skips dotfolders in some browsers. If `.github` does not appear, create it
   manually: **Add file → Create new file**, type `.github/workflows/build.yml` in the filename box
   (the slashes create the folders), paste the contents of `runner/.github/workflows/build.yml`,
   then **Commit**.
6. Confirm the Actions tab now lists a workflow called **Wrapline build**.

With git instead:

```bash
cd runner
git init && git branch -M main
git remote add origin https://github.com/<you>/apk-runner.git
git add . && git commit -m "Wrapline runner"
git push -u origin main
```

## Step 3 — Create the shared callback secret

The runner posts build status and the finished APK back to Wrapline. Both sides must hold the same
random string so nobody else can post fake builds.

1. Generate one: `openssl rand -hex 32` — or use any password manager to make a 64-character
   random string. Keep it on the clipboard for the next two steps.
2. In the **runner repo**: Settings → Secrets and variables → Actions → **New repository secret**
   - Name: `BUILD_CALLBACK_SECRET`
   - Secret: the random string
   - **Add secret**
3. In **Wrapline**, the same value goes into the secret of the same name (Step 5 below).

## Step 4 — Create the GitHub token

Wrapline needs permission to start workflow runs in the runner repo.

1. Go to <https://github.com/settings/personal-access-tokens/new> (Fine-grained tokens).
2. Token name: `wrapline-runner`.
3. Expiration: 1 year (you'll need to replace it when it expires).
4. Repository access: **Only select repositories** → pick `apk-runner`.
5. Permissions → Repository permissions → **Actions: Read and write**. Metadata read-only is added
   for you. Nothing else is needed.
6. **Generate token** and copy the `github_pat_...` value — it is shown once.

## Step 5 — Add the four secrets in Wrapline

Project Settings → Secrets (or ask the assistant to open the secure form):

| Name | Value |
| --- | --- |
| `GITHUB_BUILD_REPO` | `your-username/apk-runner` — owner/name only, no `https://` |
| `GITHUB_BUILD_TOKEN` | the `github_pat_...` token from Step 4 |
| `BUILD_CALLBACK_BASE_URL` | your published Wrapline URL, e.g. `https://your-app.lovable.app` (no trailing slash) |
| `BUILD_CALLBACK_SECRET` | the same random string as Step 3 |

Optional: `GITHUB_BUILD_REF` if your default branch is not `main`.

Important: `BUILD_CALLBACK_BASE_URL` must be a **published** URL. The `id-preview--…` URL requires a
Lovable login, so GitHub cannot reach it and every build will finish with no APK. Publish once, then
use `https://project--<project-id>.lovable.app`.

The builder page turns green ("Build runner connected") as soon as the repo and token exist.

## Step 6 — First build

1. On the builder page fill in your site URL, app name, package id (e.g. `site.graviti.ats`),
   theme colour, orientation and permissions.
2. Click **Build APK**. The log streams in live; a full build takes 4–8 minutes.
3. When it finishes, download the `.apk` and copy it to your phone.
4. On the phone: open the file → Android asks to allow installs from this source → allow → Install.

## Push notifications (optional)

1. <https://console.firebase.google.com> → **Add project**.
2. Inside the project → **Add app → Android**. The Android package name must match the package id
   exactly as shown on the builder page. Register.
3. Download `google-services.json` and upload it on the builder page.
4. Project settings → **Service accounts** → *Generate new private key* → upload that JSON too.
5. Toggle push on, rebuild, install the new APK, open it once (that registers the device).
6. Send a test from the Notifications section of the builder page.

## Signing

Upload a `.jks`/`.keystore` in Wrapline to keep future updates installable over the old app. Without
one the runner generates a throwaway keystore per build — fine for sideloading, but each build
counts as a different app, and Google Play uploads always need a stable keystore.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Build stays "queued" | Token missing Actions: Read and write, or `GITHUB_BUILD_REPO` misspelled |
| Runner finishes green but Wrapline shows nothing | `BUILD_CALLBACK_BASE_URL` is the preview URL, or the two `BUILD_CALLBACK_SECRET` values differ |
| "Workflow does not exist" | `build.yml` is not at `.github/workflows/build.yml` in the repo root |
| APK won't install | "Unknown sources" not allowed, or an older build with a different keystore is still installed — uninstall it first |
| Gradle fails on `google-services.json` | Firebase package name ≠ the package id used in the build |

## What the workflow does

1. `scripts/configure.mjs` — writes `capacitor.config.json` pointing the shell at your site.
2. `npx cap add android` — generates the native project.
3. `scripts/android-native.mjs` — permissions, orientation, version metadata, release signing config.
4. `scripts/android-push.mjs` — injects Firebase Cloud Messaging and device-token registration.
5. `gradlew assembleRelease` — builds the signed APK.
6. `scripts/report.mjs` — streams log lines and uploads the APK back to Wrapline.
