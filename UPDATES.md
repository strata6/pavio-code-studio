# Publishing Pavio updates

Only the authorized Vex owner account can publish or withdraw updates. Anyone can read the public release pointer, but cannot write it.

## One-time upgrade

Beta.14 and older portable copies have no updater. Install **Pavio Setup beta.15 or later** once. After that, Pavio checks at startup and every six hours while it is open, downloads verified releases, and highlights its ↑ Updates button when a restart is ready. Users always choose when to restart.

## Prepare a release on the publisher PC

1. Make and test the changes in the private Pavio source repository.
2. Increase `browser-source/package.json` to a higher version, such as `2.0.0-beta.16`. Keep the application ID and product name unchanged.
3. In `browser-source`, run `npm.cmd run dist`. This creates a Windows per-user NSIS installer.
4. Run `node tools/prepare-release.cjs "dist/Pavio-Setup-2.0.0-beta.16-x64.exe" "release-notes.txt"`.
5. Upload the installer and generated `.pavioupdate` file to the official **strata6/pavio-releases** GitHub repository under release tag `v2.0.0-beta.16`. The installer must keep its exact filename. The release must be published, not a draft.
6. Open Code Studio, sign in, choose **Updates → Beta**, import the small signed `.pavioupdate` file, review the version and notes, and select **Publish update**.
7. In an installed Pavio copy, open **↑ Updates → Check now** to verify delivery.

The companion `tools/upload-release.cjs` automates step 5 using the publisher PC's normal GitHub credential manager. It never sends a GitHub credential to Code Studio or Supabase.

## If a connection is interrupted

Use **Retry same operation**. The request ID and original release are retained in this tab. A repeated request is idempotent. If another owner session changed the feed, refresh before publishing again.

## Withdrawing a release

Choose **Withdraw release**. Pavio rechecks the feed immediately before installation and refuses withdrawn or replaced downloads. This does not uninstall an update that has already been installed. To undo a shipped bug, publish a fixed build with a **higher** version.

## Security and storage

- Installers are hosted publicly; the application source repository can stay private.
- Code Studio never receives the private signing key, a service-role key, or GitHub credentials.
- The release signing key is encrypted with Windows DPAPI for the publisher's Windows account, outside the project, in `%LOCALAPPDATA%/PavioPublisher/release-key.dpapi`. Keep the publisher account and PC recoverable. Losing this key requires a deliberate trust-key migration or a manual installer upgrade.
- A release is Ed25519-signed. Pavio verifies the signature, exact official URL, platform, version, size, SHA-256 and SHA-512.
- This release signature is **not a Windows Authenticode certificate**. Unsigned beta installers may show a Windows reputation warning. Do not disable Windows security settings.
- Supabase stores two small channel pointers, not installer files or user browsing information.
- Updating preserves the Pavio profile and encrypted settings. Tab URLs reopen after an approved update; unsaved form contents and running helpers do not.
- Normal browser exit never installs an update automatically.
