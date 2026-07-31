// e2e-delta.js — treibt den ECHTEN Download-Pfad des Launchers gegen eine laufende API.
//
// WARUM: `npm run test:unit` prüft die Bündelung (rangePlanner) und das Auftrennen (rangeReader)
// isoliert. Was dabei offenbleibt: ob downloadEngine.js beides richtig zusammensetzt, ob die
// signierte URL, das Manifest und die Range-Antworten eines echten Servers zusammenpassen — und ob
// ein Update wirklich nur die geänderten Dateien in WENIGEN Anfragen holt. Genau das läuft hier.
//
// Kein Electron: `launcherConfig` und `functions` ziehen `electron` nach, deshalb liegt vor dem
// ersten `require` ein Ersatz im require.cache. Die HTTP-Aufrufe werden mitgezählt — ohne Zähler
// wäre die Bündelung bloß behauptet.
//
// Aufruf (aus scripts/e2e-builds.ts der API heraus):
//   E2E_BASE=… E2E_GAME=… E2E_TOKEN=… E2E_HOME=… node scripts/e2e-delta.js --phase install|update
const fs = require("fs")
const os = require("os")
const path = require("path")
const crypto = require("crypto")
const http = require("http")
const https = require("https")
const Module = require("module")

const BASE = process.env.E2E_BASE || "http://localhost:3500"
const GAME = process.env.E2E_GAME || "e2e-testspiel"
const TOKEN = process.env.E2E_TOKEN || ""
const HOME = process.env.E2E_HOME || path.join(os.tmpdir(), "e2e-launcher")
const PHASE = process.argv.includes("--phase") ? process.argv[process.argv.indexOf("--phase") + 1] : "install"

if (!TOKEN) {
    console.error("E2E_TOKEN fehlt — dieses Skript wird von scripts/e2e-builds.ts der API gestartet.")
    process.exit(2)
}

/* -------------------- 1. electron ersetzen, BEVOR irgendetwas es lädt -------------------- */

const userData = path.join(HOME, "Electron")
fs.mkdirSync(userData, { recursive: true })
const electronStub = {
    app: {
        getPath: () => userData,
        isPackaged: false,
        getName: () => "SketchyGamesLauncherE2E",
    },
    ipcMain: { handle() {}, on() {} },
    BrowserWindow: class {},
    shell: { openExternal() {} },
    dialog: { showErrorBox: (t, m) => console.error(`[dialog] ${t}: ${m}`) },
    // functions.sendNotification baut die hier und verkettet `.addListener(...).show()` — ohne
    // passenden Ersatz stirbt der Lauf NACH einer erfolgreichen Installation an einer
    // Benachrichtigung.
    Notification: class {
        constructor(opts) {
            this.opts = opts
        }
        addListener() {
            return this
        }
        on() {
            return this
        }
        show() {
            return this
        }
    },
}
const electronId = "electron"
require.cache[electronId] = { id: electronId, filename: electronId, loaded: true, exports: electronStub }
// `require("electron")` wird nicht über den Dateipfad aufgelöst — deshalb zusätzlich der Loader-Hook.
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
    if (request === "electron") return electronId
    return origResolve.call(this, request, ...rest)
}

/* -------------------- 2. HTTP mitzählen -------------------- */

const counters = { total: 0, ranges: [], other: [] }
for (const mod of [http, https]) {
    const origGet = mod.get
    mod.get = function (url, opts, cb) {
        const options = typeof opts === "object" && opts !== null ? opts : {}
        const range = options.headers && (options.headers.Range || options.headers.range)
        counters.total++
        if (range) counters.ranges.push(String(range))
        else counters.other.push(typeof url === "string" ? url.split("?")[0] : "?")
        return origGet.apply(this, arguments)
    }
}

/* -------------------- 3. Launcher-Module laden und Session unterschieben -------------------- */

process.env.SKETCHY_API_BASE = BASE
const config = require("../src/launcherConfig")

const session = require("../src/session")
session.getToken = () => TOKEN
session.getUserId = () => "e2e-admin"
session.isLoggedIn = () => true

const engine = require("../src/downloadEngine")

/* -------------------- 4. Ablauf -------------------- */

const INSTALL_ROOT = path.join(HOME, "games") + path.sep
const INSTALL_DIR = path.join(INSTALL_ROOT, GAME)

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
}

/** Wartet, bis die Queue leer und kein Download mehr aktiv ist. */
async function waitForIdle(timeoutMs = 180000) {
    const started = Date.now()
    // Der Download startet asynchron — erst auf „aktiv" warten, dann auf „fertig".
    while (!engine.isActive() && engine.getQueue().length > 0 && Date.now() - started < 5000) await sleep(50)
    while ((engine.isActive() || engine.getQueue().length > 0) && Date.now() - started < timeoutMs) await sleep(200)
    if (engine.isActive() || engine.getQueue().length > 0) throw new Error("Download wurde nicht fertig (Zeitüberschreitung)")
}

/**
 * Momentaufnahme des Installationsordners: Pfad → { size, sha256 }.
 *
 * Bewusst der HASH und nicht die Größe: eine Änderung gleicher Länge ("…-V3" → "…-V4") wäre sonst
 * unsichtbar, und der Test hielte ein korrektes Update für ein ausgelassenes.
 */
function listInstalled() {
    const out = {}
    const walk = (dir, prefix) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix ? prefix + "/" + e.name : e.name
            const abs = path.join(dir, e.name)
            if (e.isDirectory()) walk(abs, rel)
            else out[rel] = { size: fs.statSync(abs).size, sha256: crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex") }
        }
    }
    if (fs.existsSync(INSTALL_DIR)) walk(INSTALL_DIR, "")
    return out
}

async function main() {
    console.log(`\n[launcher-e2e] Phase: ${PHASE}`)
    console.log(`[launcher-e2e] Ziel:   ${INSTALL_DIR}`)

    // Verzeichnisse und Zustandsdateien wie beim echten Start anlegen — NICHT von Hand nachbauen,
    // sonst prüft der Test eine Umgebung, die es so nie gibt (setupBackground bleibt außen vor,
    // das lädt nur ein Hintergrundbild).
    await config.setupPaths()

    const before = listInstalled()
    if (PHASE === "install" && fs.existsSync(INSTALL_DIR)) fs.rmSync(INSTALL_DIR, { recursive: true, force: true })

    engine.enqueue({
        id: GAME,
        name: GAME,
        title: "E2E Testspiel",
        installationPath: INSTALL_ROOT,
        thumbnail: "",
        categorie: "games",
    })
    await waitForIdle()

    const after = listInstalled()
    const manifestPath = path.join(INSTALL_DIR, ".sgl-manifest.json")
    if (!fs.existsSync(manifestPath)) throw new Error("kein .sgl-manifest.json im Zielordner — Installation unvollständig")
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

    // Jede Datei des Manifests muss lokal liegen und die richtige Größe haben.
    const fehlend = manifest.entries.filter(e => !(e.path in after))
    const falsch = manifest.entries.filter(e => e.path in after && after[e.path].sha256 !== e.sha256)
    if (fehlend.length) throw new Error(`fehlende Dateien: ${fehlend.map(e => e.path).join(", ")}`)
    if (falsch.length) throw new Error(`Inhalt weicht vom Manifest ab: ${falsch.map(e => e.path).join(", ")}`)

    // Das Manifest im Zielordner ändert sich bei jedem Build und sagt nichts über das Delta aus.
    const relevant = p => p !== ".sgl-manifest.json"
    const geaendert = Object.keys(after).filter(relevant).filter(p => !before[p] || before[p].sha256 !== after[p].sha256)
    const entfernt = Object.keys(before).filter(relevant).filter(p => !(p in after))

    const report = {
        phase: PHASE,
        buildId: manifest.buildId,
        version: manifest.version,
        dateienImManifest: manifest.entries.length,
        leereDateien: manifest.entries.filter(e => e.compressedSize === 0).map(e => e.path),
        rangeAnfragen: counters.ranges.length,
        andereAnfragen: counters.other.length,
        neuOderGeaendert: geaendert.sort(),
        entfernt: entfernt.sort(),
    }
    console.log("[launcher-e2e] " + JSON.stringify(report))
    fs.writeFileSync(path.join(HOME, `report-${PHASE}.json`), JSON.stringify(report, null, 2))
    console.log(`[launcher-e2e] ${PHASE} ok — ${report.rangeAnfragen} Range-Anfrage(n) für ${geaendert.length} geänderte Datei(en)`)
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error("[launcher-e2e] ✖ " + err.message)
        console.error(err.stack)
        process.exit(1)
    })
