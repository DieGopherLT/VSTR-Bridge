---
name: release
description: >-
  Orchestrate a full VSTR-Bridge extension release: regenerate CHANGELOG.md, bump the version in
  package.json, commit both together, and create + push the git tag that triggers the GitHub Actions
  release workflow. Use when the user says "release", "cut a release", "ship vX.Y.Z", "publish the
  extension", "tag a new version", or "bump and release". User-invoked only — it performs irreversible
  side effects (a pushed tag that triggers CI and a public GitHub Release).
disable-model-invocation: true
---

# Release

Drives the end-to-end release of the VSTR-Bridge VSCode extension. The authoritative, step-by-step
process lives in `.claude/rules/release-process.md` — **read it first and treat it as the source of
truth.** This skill is the executable orchestration on top of that rule; it does not restate its content,
so if the rule and this file ever disagree, the rule wins.

This is a user-invoked skill because its final steps are irreversible: pushing a tag triggers
`.github/workflows/release.yml`, which builds the `.vsix` and publishes a public GitHub Release. Do not
run the tag/push steps without explicit user confirmation of the target version.

## When invoked

1. Read `.claude/rules/release-process.md` in full — it defines the canonical sequence and the
   tag/`package.json` invariant.
2. Establish the version range: `git describe --tags --abbrev=0` for the last tag, then
   `git log <last-tag>..HEAD --pretty=format:"%h %s"` to see what shipped since.
3. Confirm the target semver `vX.Y.Z` with the user before doing anything that writes or pushes. Derive a
   suggestion from the commits (breaking → major, feat → minor, fix → patch), but the user decides.

## Steps

Follow the rule's process. Concretely:

1. **Changelog** — invoke the `changelog-generator` skill with the commit range from step 2 above. It
   updates `CHANGELOG.md` (Keep a Changelog format). The changelog documents **only extension behavior
   changes visible to users** — features, bug fixes, security changes. Exclude repo tooling, CI/CD, test
   infrastructure, linting, and docs cleanup. Move the curated entries from `[Unreleased]` into a new
   `[X.Y.Z] - <date>` section.

2. **Version bump** — set `version` in `package.json` to `X.Y.Z` (no `v` prefix in the file; the tag
   carries the `v`).

3. **Verify the invariant before going further** — the tag you are about to create and the `version` in
   `package.json` must match exactly. The release workflow uploads whichever `.vsix` `vsce` produces, and
   `vsce` names it from `package.json` (`vstr-bridge-X.Y.Z.vsix`), not from the tag. A mismatch means the
   workflow uploads a file whose name does not match the expected release asset URL. Run the guard:

   ```bash
   PKG_VERSION=$(node -p "require('./package.json').version")
   echo "package.json: $PKG_VERSION | intended tag: vX.Y.Z"
   ```

   Stop and surface the discrepancy if they do not line up.

4. **Commit** — stage `CHANGELOG.md` and `package.json` together and commit them in a single commit via
   the user's `commit` skill (it owns the message format and approval flow). The version bump is not a
   standalone commit; it is the release commit: `chore(release): bump version to vX.Y.Z`.

5. **Tag and push** — only after the commit lands and the user confirms:

   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

   This is the irreversible step. The workflow triggers automatically on the tag push.

## After pushing

Tell the user the tag is pushed and CI is running, and give them the resulting asset URL so they can
verify the release once the workflow finishes:

```
https://github.com/DieGopherLT/VSTR-Bridge/releases/download/vX.Y.Z/vstr-bridge-X.Y.Z.vsix
```

Optionally offer to watch the run with `gh run watch` if the GitHub CLI is available.
