# Pavio Code Studio

Website: https://strata6.github.io/pavio-code-studio/

An owner-authenticated dashboard for Pavio activation codes. The public page
does not grant access: sign in with an authorized Vex account to issue codes,
review status, and revoke unused codes. Ordinary Vex accounts are denied by
server-side permission checks.

## Hosting

This repository contains only the static website. GitHub Pages publishes the
root of the `main` branch. Relative asset URLs support the repository subpath.
`.nojekyll` disables Jekyll processing. No npm build or browser extension is
needed. The previous private-hosted copy is separate and unchanged.

## Security

- The Supabase publishable key in `client.mjs` is intentionally public, not an
  administrator credential. Every operation needs a valid Vex user session and
  server-checked issuer permission. No service-role keys belong in this repo.
- Passwords, tokens, and generated codes are kept in memory only. Refreshing
  signs out. New codes must be copied before leaving the page; the database
  stores only hashes, not recoverable plaintext codes.
- Generation retries reuse the same request identifier. A lost response does
  not automatically issue an additional code.
- A code can be redeemed once within 90 days. Its access term starts when it is
  redeemed. This dashboard can revoke unused codes, not existing subscriptions.
- Never commit customer codes, account credentials, test sessions, or databases.

## Plans

| Plan | Monthly | Yearly | Access |
| --- | ---: | ---: | --- |
| Basic | $2 | $10 | Typing.com and GMetrix |
| Plus | $4 | $20 | Basic, plus Canvas and IXL |
| Pro | $8 | $40 | All supported sites and advanced tools |

Listed prices describe the plans. Code generation itself does not charge a
payment method. License issuance is restricted to the configured owner.

## Verification / 1.0.1

The 1.0.1 patch fixes a browser-only `fetch` receiver error that prevented
requests from leaving the page. It also labels sign-in, history, generation,
and timeout errors separately, while preserving same-request issuance retries.

- `node --test tests/client.test.mjs` runs transport and client regression tests.
- `node tests/native-fetch.test.cjs` tests the real Chromium `Window.fetch`.
- `node tests/ui.test.cjs` tests the full UI with native browser fetch and an
  isolated protocol handler. Neither browser suite contacts real accounts.

Browser tests use `PAVIO_ELECTRON_PATH` or the existing sibling Pavio development
dependency. Screenshots and temporary profiles stay in ignored `.qa/`.
