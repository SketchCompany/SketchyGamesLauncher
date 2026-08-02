const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const secrets = require("./src/config/secrets")
const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

// Schreibt einen geteilten Schlüssel (Launcher-Shared-Key, interner Client-Key, …) verschleiert in
// ein gebündeltes, aber git-ignoriertes Modul. Der Key steht NICHT im Klartext in der Datei: pro
// Build zufälliges Salt, XOR über die Bytes, zur Laufzeit reassembliert. Kein echter Schutz gegen
// Extraktion aus dem ausgelieferten Client — nur eine Hürde (das ASAR ist zusätzlich
// integritätsgeprüft, s. Fuses).
function writeObfuscatedKeyModule(envVar, filename, label){
  const key = process.env[envVar] || ""
  const dir = path.join(__dirname, "src", "config")
  const file = path.join(dir, filename)
  if(!key){
    // Kein Key in der Build-Env → leeres Modul (Dev nutzt ohnehin die .env-Laufzeitvariable).
    fs.writeFileSync(file, "// AUTO-GENERATED at build time — do not edit, do not commit.\nmodule.exports = \"\"\n")
    console.warn(`forge: ${envVar} not set — bundling an EMPTY ${label}.`)
    return
  }
  const bytes = Buffer.from(key, "utf8")
  const salt = crypto.randomBytes(bytes.length)
  const xored = Buffer.from(bytes.map((b, i) => b ^ salt[i]))
  const content =
    "// AUTO-GENERATED at build time by forge.config.js — do not edit, do not commit.\n" +
    `// Verschleierter ${label} (XOR mit Build-Salt). Kein echter Extraktionsschutz.\n` +
    "const s = " + JSON.stringify([...salt]) + "\n" +
    "const d = " + JSON.stringify([...xored]) + "\n" +
    "module.exports = Buffer.from(d.map((b, i) => b ^ s[i])).toString(\"utf8\")\n"
  fs.writeFileSync(file, content)
  console.log(`forge: wrote obfuscated ${label} module (` + bytes.length + " bytes).")
}

module.exports = {
  hooks: {
    // Build the React/Vite renderer into src/frontend-dist before packaging so the
    // packaged app always ships an up-to-date frontend, and embed the (obfuscated)
    // launcher key so authenticated bot-bypass works in packaged builds.
    generateAssets: async () => {
      console.log("forge: building renderer (vite build)…")
      execSync("npm run build:renderer", { stdio: "inherit" })
      writeObfuscatedKeyModule("SKETCHY_LAUNCHER_KEY", "launcherKey.js", "launcher key")
      writeObfuscatedKeyModule("SKETCHY_CLIENT_KEY", "clientKey.js", "client key")
    },
  },
  packagerConfig: {
    asar: true,
    icon: "app",
    // Keep secrets, local-only files and the renderer SOURCE out of the bundle
    // (the built output in src/frontend-dist is what ships).
    ignore: [
      /^\/\.env(\..*)?$/,
      /^\/src\/tokens\.js$/,
      /^\/src\/config\/secrets\.js$/,
      /^\/src\/renderer($|\/)/,
      /^\/vite\.config\.js$/,
      /^\/\.git($|\/)/,
    ],
    // macOS Code-Signing/Notarization NUR wenn die Apple-Secrets in der Build-Env vorhanden sind.
    // So bleiben unsignierte lokale Dev-Builds funktionsfähig, während CI mit gesetzten Secrets
    // signiert & notarisiert. (Zertifikat/Team-ID via .env bzw. CI-Secrets bereitstellen.)
    ...(secrets.APPLE_ID && secrets.APPLE_ID_PASSWORD && secrets.APPLE_TEAM_ID
      ? {
          osxSign: {
            hardenedRuntime: true,
            "signature-flags": "library",
          },
          osxNotarize: {
            appleId: secrets.APPLE_ID,
            appleIdPassword: secrets.APPLE_ID_PASSWORD,
            teamId: secrets.APPLE_TEAM_ID,
          },
        }
      : {}),
  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'SketchCompany',
          name: 'SketchyGamesLauncher'
        },
        prerelease: false,
        draft: true,
        authToken: secrets.GITHUB_PUBLISH_TOKEN
      }
    }
  ],
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        authors: "Sketch Company",
        description: "The official Sketchy Games Launcher of the Sketch Company.",
        noMsi: "false",
        iconUrl: "https://sketchy-games.sketch-company.de/res?file=launcher.ico",
        icon: "app.ico",
        title: "Sketchy Games Launcher",
        setupIcon: "appSetup.ico",
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ["darwin", "linux"],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: "app.png",
          bin: "SketchyGamesLauncher",
          maintainer: "Sketch Company",
          homepage: "https://sketchy-games.sketch-company.de"
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: "app.png",
          bin: "SketchyGamesLauncher",
          maintainer: "Sketch Company",
          homepage: "https://sketchy-games.sketch-company.de"
        }
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: "ULFO",
        icon: "./app.icns",
        overwrite: true,
        debug: false,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
