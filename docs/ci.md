# Building Guignol from GitHub Actions

Automated signed + notarized macOS builds, published to GitHub Releases on each `v*` tag.

## Overview

The workflow `.github/workflows/release.yml`:

1. Runs on `macos-14` (Apple Silicon runner, needed for `codesign`).
2. Imports the Developer ID certificate into a temporary keychain dedicated to the job.
3. Runs `npm run dist:mac -- --publish always`, which triggers `electron-builder` to build, sign, notarize, and upload the artifacts to the GitHub Release associated with the tag that triggered the run.

The same `electron-builder.yml` config used for local builds is reused — CI changes nothing in the build logic, only in how credentials get to the runner.

## One-time setup

### 1. Export the Developer ID certificate

On the machine where the cert already lives in Keychain:

1. Open **Keychain Access**, select the **login** keychain.
2. Find **Developer ID Application: Your Name (TEAMID)**, expand it, right-click the certificate (or the private key beneath it) → **Export…**.
3. Save as `.p12`, set a strong password when prompted — you'll store it as a secret.
4. Base64-encode the `.p12`:
   ```bash
   base64 -i developer_id.p12 | pbcopy
   ```
   The result is now on your clipboard, ready to paste.

### 2. Create GitHub repository secrets

Repository → **Settings → Secrets and variables → Actions → New repository secret**. Create:

| Name | Value |
|---|---|
| `MAC_CERTIFICATE` | Base64 output from step 1. |
| `MAC_CERTIFICATE_PASSWORD` | Password you set when exporting the `.p12`. |
| `KEYCHAIN_PASSWORD` | Any random string (only used to lock the temp keychain during the job). Generate e.g. `openssl rand -hex 32`. |
| `APPLE_ID` | Your Apple ID email used to submit to the Notary service. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated at [appleid.apple.com](https://appleid.apple.com). |
| `APPLE_TEAM_ID` | Team ID of the Developer ID certificate (10 uppercase chars, e.g. `DTKL97AD63`). |

> `GITHUB_TOKEN` is provided automatically by the runner — no setup needed. It's used by `electron-builder --publish always` to create/upload release assets.

### 3. Verify permissions

The workflow uses `permissions: contents: write` at the job level so the token can create release assets. No repo-level settings to change unless you've tightened the default `GITHUB_TOKEN` permissions — if so, allow `contents: write` in **Settings → Actions → General → Workflow permissions**.

## Cutting a release

```bash
# Bump the version in package.json (electron-builder uses it)
npm version patch     # or: minor, major, or a specific like 0.2.0

# Push the tag
git push --follow-tags
```

When the tag `v0.1.1` (for example) reaches GitHub, the workflow:

- Creates a **draft** release with that tag.
- Uploads `Guignol-0.1.1-arm64.dmg`, `Guignol-0.1.1-x64.dmg`, `Guignol-0.1.1-arm64.zip`, `Guignol-0.1.1-x64.zip`, plus a `latest-mac.yml` manifest used by electron-updater.
- Leaves the release as draft so you can edit notes before publishing.

Promote the draft to published from the GitHub UI when you've reviewed it.

### Manual trigger

The `workflow_dispatch` trigger lets you run the build on any branch from the **Actions** tab → *Release* → *Run workflow*. Useful to smoke-test the pipeline without cutting a version.

## Costs and quotas

- **GitHub-hosted macOS runners**: public repos get free minutes (subject to GitHub Actions limits). Private repos bill macOS minutes at 10× the Linux rate — a single Guignol build consumes ~6–10 minutes, so budget accordingly.
- **Notarization**: free.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `security: "create-keychain" return -25308` | Empty or mismatched `KEYCHAIN_PASSWORD` secret | Ensure the secret is set and non-empty. |
| `errSecInternalComponent` during `codesign` | `set-key-partition-list` missing or ran before the key was imported | Keep the order: create → unlock → import → set-key-partition-list. |
| `Invalid credentials. Username or password is incorrect.` during notarization | `APPLE_APP_SPECIFIC_PASSWORD` revoked or wrong format | Regenerate on appleid.apple.com and update the secret (format is `xxxx-xxxx-xxxx-xxxx`). |
| `Please specify notarization Team ID in the APPLE_TEAM_ID env var` | `APPLE_TEAM_ID` secret missing | Set it in repository secrets; must match the Team ID of the Developer ID cert. |
| `A team ID is required for notarization` | `APPLE_TEAM_ID` missing or does not match the signing certificate | Verify with `security find-identity -v -p codesigning` locally and copy the ID in parentheses after the Developer ID Application entry. |
| `Error: EACCES` reading cert | The `.p12` was copied with extra whitespace into the secret | Re-encode with `base64 -i cert.p12` (no `-w 0` needed on macOS) and paste again, no newlines. |
| Job succeeds but no release appears | The tag trigger didn't fire because the tag was pushed without `--follow-tags`, or the workflow wasn't on the default branch when the tag was made | Push tags explicitly; keep `release.yml` on `main`. |

## Reading the logs

Each sensitive value (certs, passwords, IDs) is auto-masked by GitHub Actions when it appears in logs. The `security find-identity` line at the end of the cert-import step is a safe check that the keychain was populated — it should print one line with your Developer ID, without the fingerprint being masked (fingerprints aren't secrets). If no identity is found, the build will fail at the signing step with a clearer error.

## Expanding to Windows / Linux

To add more platforms:

1. Duplicate the `build-mac` job as `build-win` / `build-linux`, each on its own runner (`windows-latest` / `ubuntu-latest`).
2. For Windows signing, add secrets `WIN_CSC_LINK` (base64 of the `.pfx`) and `WIN_CSC_KEY_PASSWORD`; electron-builder reads them automatically.
3. Linux builds (`.AppImage`, `.deb`) don't require signing.

All three jobs can publish to the same GitHub Release by sharing the `--publish always` pattern and the `GITHUB_TOKEN`.

## References

- [electron-builder — CI](https://www.electron.build/configuration/publish)
- [Apple — Signing in CI with notarytool](https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool)
- [GitHub Actions — macos runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners)
