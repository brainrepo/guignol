# Publishing Guignol

Guide to code-sign, notarize, and distribute a macOS build.

## Prerequisites

1. **Apple Developer Program** membership ($99/year) — [developer.apple.com](https://developer.apple.com).
2. **Developer ID Application certificate** installed in Keychain (see below if missing).
3. **App-specific password** for notarization — generate from [appleid.apple.com](https://appleid.apple.com) → Security → App-Specific Passwords.
4. **Team ID** of the Developer ID team — visible in `security find-identity` output and in the developer portal Membership section.

## Getting the Developer ID Application certificate

*Skip this section if `security find-identity -v -p codesigning` already shows a line starting with `Developer ID Application:`.*

1. Open **Keychain Access** → menu **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority…**
2. Fill your email and common name, select **Saved to disk**, save the `.certSigningRequest` file.
3. Go to [developer.apple.com/account/resources/certificates/add](https://developer.apple.com/account/resources/certificates/add), select **Developer ID Application**, upload the CSR, download the `.cer`.
4. Double-click the `.cer` to install it into the login keychain.
5. Verify:
   ```bash
   security find-identity -v -p codesigning
   ```
   Expected output includes a line like `Developer ID Application: Your Name (TEAMID10CH)`.

## Configuration files

Already present in the repo:

- `electron-builder.yml` — sets `mac.hardenedRuntime: true`, `mac.notarize: true`, entitlements path, dmg + zip targets for arm64 and x64.
- `build/entitlements.mac.plist` — grants JIT, unsigned dylib loading, subprocess spawn (for the `claude` CLI), and network client.

**Team ID lives in the `APPLE_TEAM_ID` env var**, not in the YAML. Recent versions of electron-builder require passing it through the environment so the same config works with different teams (CI vs local).

## Local build credentials

Create a `.env.local` file at the repo root (already gitignored):

```bash
APPLE_ID=your-apple-id@email.com
APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop
APPLE_TEAM_ID=DTKL97AD63
```

The Team ID here is the same as in `electron-builder.yml`. `electron-builder` reads these env vars at notarization time to authenticate against Apple's Notary service.

## Building

```bash
cd /path/to/guignol
set -a; source .env.local; set +a
npm run dist:mac
```

The process takes 3–8 minutes and does:

1. **Vite build** of main, preload, renderer bundles into `out/`.
2. **electron-builder** packages the app into `.app`.
3. **Code signing** via the Developer ID certificate auto-detected in the Keychain. macOS may prompt once for keychain access; click **Always Allow**.
4. **Notarization**: uploads the `.app` to Apple, waits for the scan result, downloads and staples the notarization ticket.
5. Produces `dist/Guignol-<version>-<arch>.dmg` and `dist/Guignol-<version>-<arch>.zip` for both `arm64` and `x64`.

## Verifying the signed artifact

```bash
# Signature chain intact
codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Guignol.app

# Gatekeeper acceptance (expected: "source=Notarized Developer ID")
spctl --assess --type execute --verbose dist/mac-arm64/Guignol.app

# Check the notarization ticket is stapled (so users can launch offline)
stapler validate dist/mac-arm64/Guignol.app
```

If `spctl` reports `accepted (source=Notarized Developer ID)`, the app can be distributed to any Mac without the Gatekeeper warning dialog.

## Distribution options

Ordered from simplest to most polished:

- **GitHub Releases** (free, conventional for open source):
  ```bash
  gh release create v0.1.0 \
    --title "Guignol 0.1.0" \
    --notes "First release" \
    dist/Guignol-*.dmg dist/Guignol-*.zip
  ```
- **Static hosting** (Cloudflare R2, S3, Netlify) — upload the `.dmg`, share the link.
- **Homebrew Cask** — submit a PR to [homebrew-cask](https://github.com/Homebrew/homebrew-cask) with a formula pointing to your `.dmg`. Enables `brew install --cask guignol`.
- **Mac App Store** — *not supported by the current config*: sandboxing blocks subprocess spawn, which would prevent the `claude` CLI integration.

## Auto-update

Optional. If you want in-app update checks:

1. Install the dependency:
   ```bash
   npm install electron-updater
   ```
2. Add to `src/main/index.ts`:
   ```ts
   import { autoUpdater } from 'electron-updater'
   app.whenReady().then(() => {
     autoUpdater.checkForUpdatesAndNotify()
   })
   ```
3. Ensure `publish` in `electron-builder.yml` points to your release channel (already configured for GitHub Releases).
4. Publish with:
   ```bash
   npm run dist:mac -- --publish always
   ```
5. The app checks for new releases at boot and downloads/installs them in the background. Requires signed artifacts (`.zip` alongside `.dmg`).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `No identity found` | No Developer ID cert in Keychain | Install via the steps above. |
| `A team ID is required for notarization` | `APPLE_TEAM_ID` env var unset | Export it in `.env.local` (or set the secret on CI). |
| `Could not find a valid app-specific password` | Wrong or expired password | Regenerate from appleid.apple.com and update `.env.local`. |
| `The signature of the binary is invalid` during notarization | `hardenedRuntime` missing or wrong entitlements | Check `electron-builder.yml` and `build/entitlements.mac.plist`. |
| Notarization hangs >10 minutes | Apple service queue slow | `xcrun notarytool history --apple-id $APPLE_ID --password $APPLE_APP_SPECIFIC_PASSWORD --team-id $APPLE_TEAM_ID` to inspect. |
| User on target Mac sees *"Guignol is damaged and can't be opened"* | `.dmg` downloaded but lost the extended attribute during transfer | Re-download from the same source or `xattr -cr Guignol.app` as a last resort on the user side. |

## Costs

| Item | Cost | Required? |
|---|---|---|
| Apple Developer Program | $99/year | Yes for signed macOS distribution. |
| Windows code signing cert | ~$100–400/year (EV: $300–500) | Only if distributing Windows builds. |
| Domain + landing page hosting | ~$15/year | No — GitHub Releases suffices. |

## References

- [electron-builder docs — code signing](https://www.electron.build/code-signing)
- [electron-builder — notarize](https://www.electron.build/configuration/mac#NotarizeNotaryOptions)
- [Apple — notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Apple — hardened runtime entitlements](https://developer.apple.com/documentation/security/hardened_runtime)
