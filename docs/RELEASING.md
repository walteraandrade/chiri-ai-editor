# Releasing

Versions follow [SemVer](https://semver.org/) in `package.json`. The installed app shows its version and the short commit it was built from at the bottom of Preferences (`Desafinado 0.1.0 · 75086b9`).

1. On a branch, bump `version` in `package.json` (`pnpm version minor --no-git-tag-version`, or `patch` / `major`) and open a PR. Squash-merge it.
2. Tag the merge commit on `main` and push the tag:

   ```bash
   git switch main && git pull
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. The `Package` workflow (`.github/workflows/package.yml`) builds `release/desafinado-<version>.pacman` and attaches it to a GitHub Release named after the tag.
4. Install it: `sudo pacman -U desafinado-<version>.pacman`.

The tag must match `package.json`: `v0.2.0` for `0.2.0`. A build from an untagged commit still shows the `package.json` version, with its own commit.
