# Iteration 1 Release Process

The public repository represents the frozen EqualPath Iteration 1 submission baseline. It is not the active Iteration 2 workspace.

## Local verification

Backend:

```sh
cd appwrite-backend
npm ci
npm ci --prefix functions/delete-account
npm ci --prefix functions/iteration1-core
npm run check
npm test
```

iOS:

1. Open `equalpath/EqualPath.xcodeproj` in Xcode.
2. Select the shared `EqualPath` scheme and an available iPhone simulator.
3. Run the test action.
4. For a safe, offline demonstration, run the shared `EqualPath Iteration 1 Demo` scheme.

## Continuous delivery

After the `main` branch CI run passes, create and push a semantic version tag such as `v0.1.0`. The release workflow publishes:

- `equalpath-iteration1-<tag>.zip`
- `equalpath-iteration1-<tag>.zip.sha256`

The published bundle contains only tracked files. It does not contain dependencies, build caches, credentials, simulator state, or live user data.

## Production deployment boundary

This repository intentionally has no unattended Appwrite deployment. Deploying to a live project requires a separate approved change with a target-environment inventory, secrets configuration, backup/rollback plan, owner-isolation verification, and explicit authorization from the environment owner.

