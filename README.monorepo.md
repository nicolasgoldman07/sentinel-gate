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

## Main commands (run from repo root)

- Install dependencies (hoisted to root)

```bash
npm run bootstrap
```

- Start development (runs `dev` in workspaces in parallel via Turborepo)

```bash
npm run dev
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
