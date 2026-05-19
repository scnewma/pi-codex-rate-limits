---
name: publish-version
description: Publish a new patch/minor/major version of this pi extension to npm. Use when cutting a release, verifying npm trusted publishing, or explaining the release workflow for this repo.
---

# Publish Version

This repo publishes `@scnewma/pi-codex-rate-limits` to npm from GitHub Actions via trusted publishing.

## Steps

1. Make sure the working tree is clean:
   ```bash
   git status --short
   ```

2. Bump the package version:
   ```bash
   npm version patch
   ```
   Use `minor` or `major` instead of `patch` when appropriate.

3. Push the commit and tag:
   ```bash
   git push --follow-tags
   ```

4. Create a GitHub release for the tag:
   ```bash
   VERSION=$(node -p "require('./package.json').version")
   gh release create "v${VERSION}" --title "v${VERSION}" --notes "Publish v${VERSION}"
   ```

5. Watch the publish workflow:
   ```bash
   gh run list --limit 3
   gh run watch <run-id> --exit-status
   ```

6. Verify npm:
   ```bash
   npm view @scnewma/pi-codex-rate-limits version --registry=https://registry.npmjs.org/
   ```

## Notes

- The workflow is `.github/workflows/publish.yml`.
- It should not use `NPM_TOKEN`; npm trusted publishing handles auth through OIDC.
- If publishing fails, inspect logs with:
  ```bash
  gh run view <run-id> --job <job-id> --log-failed
  ```
