const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const secrets = require("./src/config/secrets")
const { execSync } = require("child_process")

module.exports = {
  hooks: {
    // Build the React/Vite renderer into src/frontend-dist before packaging so the
    // packaged app always ships an up-to-date frontend.
    generateAssets: async () => {
      console.log("forge: building renderer (vite build)…")
      execSync("npm run build:renderer", { stdio: "inherit" })
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
    /*osxSign: {
      identity: "Developer ID Application: ",
      hardenedRuntime: true,
      entitlements: "entitlements.mac.plist",
      "entitlements-inherit": "entitlements.mac.plist",
      "signature-flags": "library"
    }, */
  /*osxNotarize: {
      appleId: secrets.APPLE_ID,
      appleIdPassword: secrets.APPLE_ID_PASSWORD,
      teamId: secrets.APPLE_TEAM_ID,
    } */
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
    /*
    {
      name: '@electron-forge/maker-zip',
      platforms: ["darwin", "windows", "linux"],
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
    },*/
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
