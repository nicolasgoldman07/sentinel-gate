# Sentinel Gate — Monorepo

This repository is prepared as a monorepo using npm workspaces and Turborepo. The goal is to keep the application (`sentinel`) and infrastructure (`infra`) in the same repository while making builds, typechecks and dev workflows fast and consistent.

## Quick layout

```
/ (repo root)
	package.json            # root workspace manifest (scripts + devDeps)
	turbo.json              # turborepo pipeline config
	tsconfig.json           # shared TypeScript base config
	.gitignore
	packages/
		sentinel/             # the application (workspace package)
			package.json
			src/
		infra/                # infra-as-code, empty for now
```

## Prerequisites

- Node.js >= 18
- npm (we use npm workspaces in this repo)
- Docker & Docker Compose (for running Keycloak locally)

## Main commands (run from repo root)

- Install dependencies (hoisted to root)

```bash
npm run bootstrap
```

- Start Keycloak (required for authentication)

```bash
npm run keycloak:start
```

- Start development (runs `dev` in workspaces in parallel via Turborepo)

```bash
npm run dev
```

- Start everything (Keycloak + dev)

```bash
npm run dev:all
```

- Stop Keycloak

```bash
npm run keycloak:stop
```

- View Keycloak logs

```bash
npm run keycloak:logs
```

- Build all packages (uses Turborepo caching)

```bash
npm run build
```

- Run TypeScript type-checks across workspaces

```bash
npm run typecheck
```

- Run a Turborepo task manually

```bash
npm run turbo:run -- <task>
```

## Authentication with Keycloak

Sentinel uses Keycloak for authentication and authorization. All protected endpoints require a valid JWT token issued by Keycloak.

### Quick start (local development)

1. Start Keycloak:

```bash
npm run keycloak:start
```

2. Wait ~30 seconds for Keycloak to be ready, then access the admin console:

   - URL: http://localhost:8080
   - Admin credentials: `admin` / `admin`

3. The `sentinel` realm is auto-imported with:

   - Client: `sentinel-api`
   - Users: `admin` (password: `admin123`), `testuser` (password: `user123`)
   - Roles: `admin`, `user`, `ua`, `operaciones`, `finance`

4. Get a token using the Direct Access Grant flow (Resource Owner Password Credentials):

```bash
curl -X POST http://localhost:8080/realms/sentinel/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=sentinel-api" \
  -d "username=admin" \
  -d "password=admin123"
```

Response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "token_type": "Bearer"
}
```

5. Use the `access_token` in requests to Sentinel:

```bash
export TOKEN="<your_access_token>"

# Health check
curl http://localhost:3000/health

# Auth info (no token required)
curl http://localhost:3000/auth/info

# Verify token (requires auth)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/auth/verify

# Make a policy decision (requires auth)
curl -X POST http://localhost:3000/decision \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": { "sub": "admin", "roles": ["admin"] },
    "action": "padron:edit",
    "resource": { "type": "padron", "status": "OPEN" }
  }'
```

### Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

Key variables:

- `KEYCLOAK_SERVER_URL` — Keycloak server URL (default: `http://localhost:8080`)
- `KEYCLOAK_REALM` — Keycloak realm name (default: `sentinel`)
- `KEYCLOAK_CLIENT_ID` — Client ID for Sentinel API (default: `sentinel-api`)

### Token validation flow

1. Client obtains a token from Keycloak (via login or password grant).
2. Client sends requests to Sentinel with `Authorization: Bearer <token>`.
3. Sentinel validates the token:
   - Fetches Keycloak's public keys (JWKS endpoint).
   - Verifies the token signature, issuer, audience, and expiration.
   - Extracts user claims (sub, roles, custom attributes).
4. If valid, the request proceeds; otherwise, returns 401 Unauthorized.

### Managing users and roles

- Access Keycloak admin console: http://localhost:8080
- Navigate to the `sentinel` realm → Users or Roles.
- Add/edit users and assign roles as needed.
- Export the realm configuration for version control:

```bash
docker exec -it sentinel-keycloak /opt/keycloak/bin/kc.sh export \
  --dir /tmp --realm sentinel
docker cp sentinel-keycloak:/tmp/sentinel-realm.json packages/infra/keycloak/realm-export.json
```

## How the `sentinel` package works

- The application package lives at `packages/sentinel/` and exposes scripts:
  - `dev` — start the server using `tsx watch src/server.ts`
  - `build` — compile via `tsc -p tsconfig.build.json`
  - `typecheck` — `tsc -p tsconfig.json --noEmit --allowImportingTsExtensions`

## Adding a new package

1. Create the directory `packages/<your-package>`.
2. Add a `package.json` with name and scripts.
3. Add TypeScript config if needed (you can extend the root `tsconfig.json`).
4. Run `npm install` at the root.

## Notes about imports and ESM

- This repo uses ESM (`type: "module"`) and explicit `.js` extensions in runtime imports (TypeScript is configured to allow importing `.ts` extensions for dev/typecheck). If you add new files, follow the existing pattern: runtime imports use `.js` and TS sources remain `.ts` (TypeScript will map correctly when building).

## Cleaning up duplicates (if present)

- During the migration you may have duplicate sources under the repo root and under `packages/sentinel/`. Once you confirm the package works from `packages/sentinel/`, remove the root copies and commit the change. Example:

```bash
# remove tracked files that should no longer be in root
git rm -r --cached src
git commit -m "chore: move app to packages/sentinel"
```

## Turborepo notes

- `turbo.json` contains a pipeline that caches `build` outputs and runs `typecheck`/`dev` in a sensible order. `dev` is typically run without cache to observe live behavior.
- For CI you can enable remote caching (Vercel, S3, etc.) to speed up builds across runs.

## .gitignore & caches

- `.gitignore` includes `.turbo/` and other common entries. If you add remote cache credentials or local artifacts, make sure they are ignored or encrypted in CI.

## CI example (recommendation)

- In CI you typically run:
  1.  `npm ci` (or `npm install`)
  2.  `npm run typecheck`
  3.  `npm run build`

## Extras & conventions

- Keep devDependencies hoisted at the repo root to avoid duplication.
- Use Prettier/ESLint at the root to enforce style across packages (I can scaffold configuration if you want).
- Add package-level READMEs for package-specific developer docs.

If you want, I can:

- Finalize the move (delete duplicates from root) and run `npm install` + `npm run typecheck` to validate everything.
- Add a GitHub Actions workflow that uses Turborepo caching.
- Add Prettier/ESLint and a `format`/`lint` pipeline.

Happy to continue — dime cuál de las tareas adicionales quieres que haga ahora.
