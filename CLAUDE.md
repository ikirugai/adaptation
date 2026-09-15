# Adaptation (public SDK): rules for any Claude (or human) working in this repo

Company-wide rules are in `ikirugai/dev-setup/CLAUDE.company.md` and apply here; this file adds what is specific to this repo.

## What it is
Public, MIT-licensed home of the two npm packages for Adaptation: `@ikirugai/adapt-react` (Adapt button, drawer, kanban card, library and bakes tabs, snip overlay, compare view, voice button) and `@ikirugai/adapt-server` (`defineSurface`, Postgres session helper, route-handler factories for the 13 Adapt API routes, DSL types, generic patch applier). The engine that makes them do anything (worker, claude-runner, slack-approver, the demo surfaces) lives in the private repo `ikirugai/adaptivesoftware`. This repo exists so the packages can be published with npm provenance from a public GitHub repo. Status: v0.1.0 tagged and published May 2026, no changes since.

Repo layout note: the git repo is the inner folder `Adaptation/adaptation`, not `Adaptation/`. Open Claude Code in the inner folder. After the move to `~/Code/ikirugai/` it should simply be `~/Code/ikirugai/adaptation`.

## Architecture
| Layer | Technology | Where |
|---|---|---|
| React components | React 18+ (19 RC in dev), framer-motion, lucide-react, html2canvas-pro, tsup ESM build | `packages/adapt-react` |
| Server primitives | Next.js 15 route handlers, `pg`, tsup ESM build; exports `.` and `./handlers` | `packages/adapt-server` |
| Publishing | GitHub Actions on tag `adapt-v*`, npm provenance, GitHub Release | `.github/workflows/publish.yml` |
| Docs | root README and per-package READMEs (these are the npm pages) | `README.md`, `packages/*/README.md` |

There is no app, database or server here. Consumers need Postgres and the private engine; the live demo is served from the private repo.

## Environments
| env | branch / ref | URL | how it deploys |
|---|---|---|---|
| source | `main` | https://github.com/ikirugai/adaptation | push |
| npm release | tag `adapt-vX.Y.Z` | https://www.npmjs.com/package/@ikirugai/adapt-react and https://www.npmjs.com/package/@ikirugai/adapt-server | `publish.yml` builds both packages, runs `npm pack --dry-run` on both, then `npm publish --provenance --access public`, then creates a GitHub Release with generated notes |
| live demo | n/a | https://adapt.ikirugai.com | from `ikirugai/adaptivesoftware` on ikirugaiLINUX, not from here |

## Run locally
```bash
cd packages/adapt-react  && npm install --legacy-peer-deps && npm run build && npm pack --dry-run
cd packages/adapt-server && npm install --legacy-peer-deps && npm run build && npm pack --dry-run
```
Each tarball must contain only `dist/`, `README.md`, `LICENSE` and `package.json`. If `src/` or config files appear, tighten `files` in that `package.json`.

## Release
1. Bump `version` in both `packages/*/package.json` (keep them equal) and commit to `main`.
2. `git tag adapt-vX.Y.Z -m "Adaptation vX.Y.Z"` then `git push origin main --follow-tags`.
3. Watch the Actions run, then `npm view @ikirugai/adapt-react version`.
Pushing a tag publishes a public package, which is a production action: ask Patrick first. Never `npm publish` from a laptop; provenance only works from the workflow. Within 72 hours a broken version can be unpublished; after that use `npm deprecate` and bump.

## Tests and checks
No test suite. The checks are the build and `npm pack --dry-run` above, plus a scratch install:
```bash
cd /tmp && mkdir -p adapt-smoke && cd adapt-smoke && npm init -y >/dev/null
npm install /path/to/ikirugai-adapt-react-X.Y.Z.tgz /path/to/ikirugai-adapt-server-X.Y.Z.tgz next@15 react@18 react-dom@18
node -e "console.log(Object.keys(require('@ikirugai/adapt-server')))"
```

## Secrets
- `NPM_TOKEN`: GitHub Actions repository secret on `ikirugai/adaptation`. An npm Automation token scoped to the `@ikirugai` org, created at npmjs.com by Patrick and recorded in Bitwarden. The npm account has 2FA on. Nothing else; there is no `.env` in this repo.

## Gotchas
- 2026-05: the private repo `ikirugai/adaptivesoftware` carries copies of these packages under `packages/` and has moved ahead (0.1.2 there, 0.1.0 here). Changes are copied by hand; check both sides before editing either.
- 2026-05: `npm install` needs `--legacy-peer-deps` because devDependencies pin a React 19 RC while peers declare `react >=18`.
- 2026-05: the build runs `scripts/add-js-extensions.mjs` after tsup so ESM imports carry `.js` suffixes. Do not remove it; Node ESM consumers break without it.
- 2026-05: `packages/*/package-lock.json` are untracked locally and are not committed. Leave them out.
- Publish half-states are possible (adapt-react succeeds, adapt-server fails). If that happens bump both and re-tag rather than republishing one.
- The engine prompt and DSL spec prompt are intentionally not in these packages. Do not add them.
- `adapt-server` README still points at the private repo for the project link; the package.json `repository` fields point here. Keep `repository.url` matching this repo or provenance fails.

## Status and next steps
- 2026-05-20: single commit `init: public SDK packages for Adaptation`, tag `adapt-v0.1.0` pushed, both packages published at 0.1.0.
- 2026-09-15: nothing since. Next: port the 0.1.1 and 0.1.2 fixes from the private repo (ESM build fixes, Next `^15.5.18` bump, repository URLs), bump both to 0.1.2, tag `adapt-v0.1.2`. Consider making this repo the only source of the packages and having the private repo depend on the published versions.

## Visual verification
No UI to render here. Verify component changes by copying them into `ikirugai/adaptivesoftware`, running a surface, and screenshotting it as that repo's `CLAUDE.md` describes.
