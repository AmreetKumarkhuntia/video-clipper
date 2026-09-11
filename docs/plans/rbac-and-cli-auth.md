# Roles and browser-based CLI sign-in

## Current implementation

PR #37 replaces the interim `OPERATOR_TOKEN` settings gate with permissions on authenticated
customer sessions. The follow-up review consolidates permission storage, replaces the CLI device
flow with a browser callback, and makes encryption depend on an explicitly provisioned secret.

## Roles and migration

`roles(id, rank, created_at, permissions)` stores each role's permissions as JSON.
`customers.role_id` defaults to `customer`; the seeded administrator role has `settings:write`.
Every session resolution loads the current grants, so role changes take effect on the next request.
Zod validates stored permission arrays; invalid or absent roles grant no permissions.

The single unreleased auth migration, `0011_rbac_and_cli_login`, upgrades databases through
migration `0010` directly to the final schema. It creates `roles` with JSON `permissions`, seeds
`customer` and `admin`, and adds `customers.role_id` with the `customer` default. Existing
customers, identities and sessions are retained; `role_permissions` and `login_requests` are
never created. Migrations through `0010` remain unchanged.

The intermediate PR versions of `0011` and `0012` are not a supported upgrade source for this
consolidated migration. Preserve any development database that already applied them: back up its
database and matching secret, then explicitly review and reconcile its schema and migration
history, including custom roles and grants. A separate, fresh development database is another
option; it does not require deleting or resetting the old database.

`INITIAL_ADMIN_EMAIL` promotes the matching, Google-verified email during sign-in only while no
administrator exists. Assignment is audit-logged. Removing the setting after bootstrap and
restoring it when no administrator remains provides recovery without a self-promotion endpoint.

## CLI browser callback

1. The CLI retries outstanding session revocations, binds `127.0.0.1` on a temporary port, and
   generates a random state plus a PKCE verifier.
2. `POST /api/auth/cli/start` accepts the exact loopback callback URI, state and S256 challenge.
   It returns a browser authorization URL and expiration time.
3. `GET /api/auth/cli/authorize?request=…` binds the pending request to a new Google handshake
   and opens Google's account chooser. HttpOnly cookies carry the normal handshake and request ID.
4. Google's existing registered callback validates both the browser state and the stored request
   binding before contacting Google. It establishes or rotates the ordinary browser session.
5. A redirect to `http://127.0.0.1:<port>/callback` carries only a one-use exchange code and CLI
   state. The server stores the exchange-code hash, customer ID and challenge, never a bearer.
6. `POST /api/auth/cli/exchange` validates the code, S256 verifier, expiration and exact redirect
   URI. It consumes the grant synchronously and mints a separate CLI session.
7. The CLI validates and writes the credential atomically with owner-only permissions. If saving
   fails after exchange, it attempts revocation and reports failure.

There is no user-facing code to enter or compare, approval page, polling loop, or persisted login
request. Internal exchange codes are not session tokens. Browser and CLI sessions are independent;
CLI logout does not revoke the browser session.

Pending requests live for ten minutes and exchange grants for sixty seconds in a store owned by
one backend app instance. The configured outstanding cap covers pending, processing and exchange
states. Per-client budgets apply separately to start, authorize and exchange, returning `429`
with `Retry-After`. Forwarded addresses are trusted only when `TRUSTED_PROXY_HOPS` is configured.
Requests behind one IP remain independent. Restarting the backend invalidates unfinished logins.

The listener accepts only its exact loopback host, port, path and expected state. Invalid requests
do not complete login. Completion, timeout or Ctrl-C closes it. A failed browser launch prints a
URL to open manually on the same machine. Existing credentials remain compatible; obsolete
approval/poll endpoints return `410` with an upgrade instruction.

## Encryption and settings

The encryption service is entered through `@lib/services/encryption/index.js`. Its explicit
`db → encryption` dependency is covered by architecture tests. Shared constants retain the
`GOOGLE.SIGN_IN.TOKEN_CIPHER_PREFIX` hierarchy and existing AES-256-GCM `enc:v1:` format.

Backend startup requires `TOKEN_ENCRYPTION_KEY`, a canonical base64-encoded 32-byte secret.
The config layer reads it exclusively from the deployment environment (including normal dotenv
bootstrap), outside editable application settings. The backend never generates or reads key files.
Missing or malformed keys fail before opening the database; an incorrect key fails before token
migration or serving requests. Legacy plaintext rows are encrypted once the key is validated.

Settings writes still require `settings:write`. Read-only controls and Reset remain disabled and
queued autosaves are canceled when permission disappears. Neither settings responses nor mutable
config can expose or change the encryption key. Logout/re-login retains its secure revocation
retry behavior and corrupt credentials remain recoverable through Zod validation.

## Verification and operations

Regression coverage includes old ciphertext fixtures, database/secret restoration, secret
exclusion, fresh and pre-PR database migrations, bootstrap, API permission guards, Google callback state,
PKCE, expiry/replay races, independent sessions, rate limits, and callback listener lifecycle.
Run `pnpm type-check`, `pnpm test` and `pnpm web:check`. Browser smoke-test artifacts belong
under `temp/`.

Run the opt-in Chromium smoke with
`RUN_AUTH_BROWSER_TEST=1 pnpm exec vitest run tests/authBrowser.test.ts`. It uses a local mock
Google consent server with real API cookies, SQLite, redirects, and the CLI loopback listener.
Install the Playwright Chromium browser first if it is not already available.

Before upgrading, back up the database and matching secret and provision the existing key file's
base64 value as `TOKEN_ENCRYPTION_KEY`. Upgrade backend and CLI together. Do not generate a new
key for an existing encrypted database. Only this unreleased PR's auth migrations are consolidated;
previously released migrations are unchanged. See the migration caveat above for databases that
used intermediate PR versions, and the
[configuration guide](../guides/configuration.md#provider-tokens-at-rest) for recovery steps.

The callback assumes a browser on the CLI machine and a single backend process. Headless remote
login, distributed handshake storage, key rotation and a role-management UI remain future work.
