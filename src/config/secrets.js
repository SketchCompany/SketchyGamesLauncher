// Build-/publish-time secrets, loaded from the environment — NEVER hard-coded
// and NEVER bundled into the shipped app. For local builds put the values in a
// git-ignored `.env` file at the project root; in CI provide them as secrets.
//
// This module is only consumed by `forge.config.js` during `make`/`publish`.
// The packaged application does not require it.
const dotenvExpand = require("dotenv-expand")
const dotenv = require("dotenv")

dotenvExpand.expand(dotenv.config())

module.exports = {
    // GitHub token used by the publisher to upload releases (needs `repo` scope).
    GITHUB_PUBLISH_TOKEN: process.env.GITHUB_PUBLISH_TOKEN || "",
    // Apple credentials used for macOS code-signing / notarization.
    APPLE_ID: process.env.APPLE_ID || "",
    APPLE_ID_PASSWORD: process.env.APPLE_ID_PASSWORD || "",
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID || "",
}
