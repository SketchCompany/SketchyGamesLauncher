const { defineConfig } = require("vite")
const react = require("@vitejs/plugin-react").default
const tailwindcss = require("@tailwindcss/vite").default
const path = require("path")

// The renderer (React SPA) lives in src/renderer and builds into src/frontend-dist,
// which the local Express server (src/launcher.js) serves over http://localhost:<PORT>.
// We use a relative base so the bundle works regardless of the route depth the
// SPA-fallback serves index.html from.
module.exports = defineConfig({
    root: path.resolve(__dirname, "src/renderer"),
    base: "/",
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src/renderer"),
        },
    },
    // Launcher-Version zur Build-Zeit einbetten (im Auth-Header angezeigt).
    define: {
        __APP_VERSION__: JSON.stringify(require(path.resolve(__dirname, "package.json")).version),
    },
    build: {
        outDir: path.resolve(__dirname, "src/frontend-dist"),
        emptyOutDir: true,
        chunkSizeWarningLimit: 1200,
    },
    server: {
        port: 5173,
    },
})
