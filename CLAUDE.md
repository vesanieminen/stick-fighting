# Stick Fighter - Project Instructions

## Version Bumping

When making changes to the game code, bump the version in `package.json` before building:
- **Bug fixes / small tweaks**: `npm version patch` (1.0.0 → 1.0.1)
- **New features / gameplay changes**: `npm version minor` (1.0.0 → 1.1.0)
- **Breaking / major reworks**: `npm version major` (1.0.0 → 2.0.0)

The version is injected at build time via `vite.config.js` and displayed on the title screen.
