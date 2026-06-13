# Release Process

Before creating any release or bumping the version in `package.json`, always invoke the
`changelog-generator` skill to update `CHANGELOG.md` first.

The changelog documents **extension behavior changes only** — new features, bug fixes, and
security changes visible to users of the extension. Do not include repo tooling, CI/CD setup,
test infrastructure, linting rules, documentation cleanup, or any change that does not affect
the extension's runtime behavior.

## Steps

1. Run the `changelog-generator` skill with the commits since the last tag:

   ```bash
   git log v<last-tag>..HEAD --pretty=format:"%h %s"
   ```

2. Update `CHANGELOG.md` following the Keep a Changelog format.
3. Bump `version` in `package.json` to the new semver value.
4. Commit `CHANGELOG.md` and `package.json` together in a single commit. The bump is not a
   standalone commit — it is part of the commit that justifies the version change (e.g. the
   feature commit, the fix commit, or a dedicated release commit when there is no single
   triggering change): `chore(release): bump version to vX.Y.Z`.
5. Create and push the git tag:

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

The GitHub Actions workflow (`.github/workflows/release.yml`) triggers automatically on tag push
and uploads the `.vsix` to the GitHub Release. The static download URL will be:

```text
https://github.com/DieGopherLT/VSTR-Bridge/releases/download/vX.Y.Z/vstr-bridge-X.Y.Z.vsix
```
