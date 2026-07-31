// downloadEngine.js — kompletter Download-/Update-Pfad des Launchers (aus api.js extrahiert).
//
// Zwei Modi:
//  - DELTA (Standard): Die API liefert pro Build ein Manifest (Pfad, Größe, sha256, Modus,
//    exakter Daten-Offset im Zip). Der Launcher vergleicht es mit dem lokal installierten
//    Manifest (.sgl-manifest.json im Installationsordner) und lädt per HTTP-Range NUR die
//    geänderten/neuen Einträge aus dem signierten Build-Zip; gelöschte Dateien werden lokal
//    entfernt. Eine Erstinstallation ist derselbe Pfad mit leerem lokalem Manifest.
//  - GANZ-ZIP (Fallback): kein/fehlerhaftes Manifest, `unsupported`-Flag oder ein Server/Proxy,
//    der Range ignoriert (200 statt 206) → das komplette Zip wird geladen (mit Byte-Resume),
//    sha256-geprüft und entpackt (zip-slip-sicher, Datei-Modi wiederhergestellt).
//
// Fortsetzen über Neustarts: der Fortschritt wird pro Datei in <downloads>/<name>.state.json
// persistiert; resumeInterrupted() (Hintergrund-Startup) reiht abgebrochene Downloads wieder
// ein — bereits verifizierte Dateien werden NIE erneut geladen. Explizites Abbrechen (Cancel)
// verwirft den Zustand bewusst; Resume gilt nur für Crash/Netzabbruch/Beenden.
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const zlib = require("zlib")
const http = require("http")
const https = require("https")
const unzipper = require("unzipper")
const func = require("./functions")
const config = require("./launcherConfig")
const session = require("./session")
const { apiUrl } = require("./apiBase")
const notificationStore = require("./notificationStore")
const { planRanges } = require("./rangePlanner")
const { makeReader, splitRun, ShortReadError } = require("./rangeReader")

// ---------------------------------------------------------------------------
// Modul-Zustand (ein Download zur Zeit, wie bisher)
// ---------------------------------------------------------------------------
let downloadProgress = 0
let downloadTime = { hours: 0, minutes: 0, seconds: 0 }
let downloadSpeed = 0
let downloadSize = 0
let isDownloading = false
const downloadQueue = []
let currentDownloadResponse = null
let currentDownloadWriteStream = null
let pauseRequested = false
let cancelRequested = false
let queueAdvancedByCancel = false
let lastDownloadProgress = 0

function resetDownloadState(){
    downloadProgress = 0
    downloadSpeed = 0
    downloadSize = 0
    downloadTime = { hours: 0, minutes: 0, seconds: 0 }
    isDownloading = false
    pauseRequested = false
}

// Typisierte Steuer-Fehler des Delta-Laufs.
class FallbackError extends Error {}      // → Ganz-Zip-Fallback
class UrlExpiredError extends Error {}    // 403 auf Objekt-Route → neue signierte URL holen
class CancelledError extends Error {}     // Nutzer-Abbruch über /download/cancel
class RetryableError extends Error {}     // 429/5xx oder Abbruch mittendrin → noch einmal versuchen

// ---------------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------------
function isPathInside(child, parent){
    if(!child || !parent) return false
    const rel = path.relative(path.resolve(parent), path.resolve(child))
    return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel)
}
function clientFor(url){
    return url.startsWith("http:") ? http : https
}
function statePath(name){
    return config.downloads + name + ".state.json"
}
function localManifestPath(installDir){
    return path.join(installDir, ".sgl-manifest.json")
}
async function writeJsonAtomic(file, obj){
    const tmp = file + ".tmp"
    await fs.promises.writeFile(tmp, JSON.stringify(obj, null, "\t"))
    await fs.promises.rename(tmp, file)
}
async function readJson(file){
    try{ return JSON.parse(await fs.promises.readFile(file, "utf8")) }
    catch(e){ return null }
}
function sleep(ms){ return new Promise(r => setTimeout(r, ms)) }

/** Wartet, solange der Nutzer pausiert hat (Lücke ZWISCHEN zwei Datei-Requests). */
async function waitWhilePaused(){
    while(pauseRequested && !cancelRequested) await sleep(200)
    if(cancelRequested) throw new CancelledError("canceled")
}

/**
 * Returns the expected SHA-256 of a product's package as provided by the store
 * backend, or null when the backend did not supply one.
 */
function expectedChecksum(product){
    return product.sha256 || product.checksum || product.hash || null
}
/**
 * Computes the SHA-256 of a file by streaming it (no full read into memory).
 */
function sha256File(filePath){
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256")
        const stream = fs.createReadStream(filePath)
        stream.on("data", chunk => hash.update(chunk))
        stream.on("end", () => resolve(hash.digest("hex")))
        stream.on("error", reject)
    })
}
async function getDirectorySize(dirPath){
    let size = 0
    const files = await func.readDir(dirPath)
    for (let i = 0; i < files.length; i++) {
        const filePath = dirPath + "/" + files[i]
        const stats = fs.statSync(filePath)
        if(stats.isFile()) size += stats.size
        else if(stats.isDirectory()) size += await getDirectorySize(filePath)
    }
    return size
}

// ---------------------------------------------------------------------------
// Fortschritts-Verwaltung (Werte + Mathe wie bisher, Downloads.jsx verlässt sich darauf)
// ---------------------------------------------------------------------------
let progressTotalBytes = 0     // Gesamtbytes dieses Laufs (inkl. bereits erledigter)
let progressDoneBytes = 0      // davon erledigt (persistiert + aktueller Lauf)
let progressSessionBytes = 0   // nur in DIESEM Prozesslauf geladene Bytes (für die Speed-Anzeige)
let progressSessionStart = 0

function progressReset(totalBytes, doneBytes){
    progressTotalBytes = totalBytes
    progressDoneBytes = doneBytes
    progressSessionBytes = 0
    progressSessionStart = Date.now()
    downloadSize = totalBytes
}
function progressAdd(chunkLength){
    progressDoneBytes += chunkLength
    progressSessionBytes += chunkLength
    const elapsed = (Date.now() - progressSessionStart) / 1000
    const speed = (progressSessionBytes / Math.max(elapsed, 0.001)) / (1024 * 1024)
    const remaining = Math.max(progressTotalBytes - progressDoneBytes, 0)
    const eta = Math.round(remaining / Math.max(speed * 1024 * 1024, 1))
    let hours = Math.floor(eta / 3600).toString()
    let minutes = Math.floor(eta % 3600 / 60).toString()
    let seconds = Math.floor(eta % 3600 % 60).toString()
    if(parseInt(hours) < 10) hours = "0" + hours
    if(parseInt(minutes) < 10) minutes = "0" + minutes
    if(parseInt(seconds) < 10) seconds = "0" + seconds
    downloadTime = { hours, minutes, seconds }
    // Bewusst percentage-1 (nie „fertig anzeigen bevor verifiziert“) — der 99→0→100-Flip
    // in getProgress() gleicht das beim Abschluss aus.
    const pct = progressTotalBytes > 0 ? Math.round((progressDoneBytes / progressTotalBytes) * 100) - 1 : 0
    downloadProgress = Math.max(pct, 0)
    downloadSpeed = speed.toFixed(2)
}

// ---------------------------------------------------------------------------
// Registry (installsFile) — gemeinsame Schreiblogik für Delta- und Zip-Pfad
// ---------------------------------------------------------------------------
async function registerInstall(product){
    const installs = JSON.parse(await func.read(config.installsFile))
    if(!Array.isArray(installs.games)) installs.games = []
    for (let i = 0; i < installs.games.length; i++) {
        if(installs.games[i].name == product.name){
            installs.games.splice(i, 1)
            break
        }
    }
    installs.games.push(product)
    await func.write(config.installsFile, JSON.stringify(installs, null, 3))
}

// ---------------------------------------------------------------------------
// Ganz-Zip-Pfad (Fallback): Entpacken (zip-slip-sicher, Modi wiederherstellen)
// ---------------------------------------------------------------------------
/**
 * Extracts a zip into ```destination``` while rejecting any entry whose resolved
 * path would land outside of ```destination``` (zip-slip protection).
 */
async function safeExtract(zipPath, destination){
    const directory = await unzipper.Open.file(zipPath)
    const destRoot = path.resolve(destination)
    for(const file of directory.files){
        const targetPath = path.resolve(destRoot, file.path)
        if(targetPath !== destRoot && !targetPath.startsWith(destRoot + path.sep)){
            throw new Error("zip-slip: refused to extract entry outside destination: " + file.path)
        }
        if(file.type === "Directory"){
            await fs.promises.mkdir(targetPath, { recursive: true })
            continue
        }
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
        await new Promise((resolve, reject) => {
            file.stream()
                .pipe(fs.createWriteStream(targetPath))
                .on("finish", resolve)
                .on("error", reject)
        })
        // Unix-Dateirechte aus dem Zip wiederherstellen (Executable-Bit für macOS-.apps).
        const mode = (file.externalFileAttributes >>> 16) & 0o7777
        if(mode) await fs.promises.chmod(targetPath, mode)
    }
}

// ---------------------------------------------------------------------------
// Download-Zähler der API (nur Statistik, Fehler unkritisch)
// ---------------------------------------------------------------------------
async function addToAccount(product){
    try{
        const token = session.getToken()
        const gameId = product && (product.id || product.gameId)
        if(token && gameId && await func.checkInternetConnection() == 2){
            await func.send("/v1/store/" + encodeURIComponent(gameId) + "/download", {}, { token }).catch((e) => console.warn("addToAccount: download count failed:", e.message))
        }
    }
    catch(err){
        console.error("addToAccount:", err)
    }
}

/**
 * Nimmt ein erledigtes Update aus ```updatesFile``` und entfernt die zugehörige
 * „Update verfügbar"-Benachrichtigung. Ohne das bliebe beides nach dem Aktualisieren stehen.
 */
async function clearPendingUpdate(name){
    try{
        const parsed = JSON.parse(await func.read(config.updatesFile))
        const updates = Array.isArray(parsed.updates) ? parsed.updates.filter(u => u.name !== name) : []
        if(!Array.isArray(parsed.updates) || updates.length !== parsed.updates.length){
            await func.write(config.updatesFile, JSON.stringify({ updates }, null, 3))
        }
        await notificationStore.removeByKey("update:" + name, { force: true })
    }
    catch(err){ console.error("clearPendingUpdate:", err) }
}

// ---------------------------------------------------------------------------
// Gemeinsamer Abschluss: Cover, Registry, lokales Manifest, Shortcut, Zähler
// ---------------------------------------------------------------------------
async function finishInstall(product, installDir, remoteManifest){
    // Cover VOR dem Registry-Schreiben laden (setzt product.img).
    await func.downloadCoverImage(product)
    product.size = await getDirectorySize(installDir)
    product.start = installDir + product.name + config.appExt
    // Nur informativ (Aufräumliste/Support) — sichtbar ist ein Spiel allein über seine Lizenz.
    product.installedBy = session.getUserId()
    await registerInstall(product)
    // Der Download kam nur mit gültiger Lizenz zustande (signierte URL) → Besitz-Spiegel nachziehen,
    // sonst filtert /api/installs das gerade installierte Spiel heraus.
    try{ require("./ownership").markOwned(product.name) }
    catch(err){ console.error("finishInstall: ownership.markOwned failed:", err) }
    // Erledigtes Update aus updatesFile + Glocke nehmen (sonst bleibt „Update verfügbar" stehen).
    await clearPendingUpdate(product.name)
    if(remoteManifest){
        await writeJsonAtomic(localManifestPath(installDir), remoteManifest)
    }
    await fs.promises.rm(statePath(product.name), { force: true }).catch(() => {})
    let createShortcut = true
    if(product.createShortcut != undefined){
        createShortcut = !!product.createShortcut
        delete product["createShortcut"]
    }
    if(createShortcut) func.createShortcut(product.name, product.start, product.start)
    await addToAccount(product)

    // Persistente Benachrichtigung „Installation abgeschlossen" (überlebt Neustart) + OS-Toast.
    try{
        await notificationStore.add({
            // Bewusst OHNE key: jede abgeschlossene Installation/Aktualisierung soll melden
            // (ein noch offener Eintrag darf ein späteres Update nicht unterdrücken).
            type: "success",
            title: "Installation abgeschlossen",
            message: `${product.title || product.name} wurde erfolgreich installiert.`,
            actions: [
                { kind: "play", gameId: product.name, ...(product.start ? { start: product.start } : {}), ...(product.title ? { title: product.title } : {}), label: "Spiel starten" },
                { kind: "navigate", to: "/library", label: "In der Bibliothek ansehen" },
            ],
        }, { os: true })
    }
    catch(err){ console.error("finishInstall: notification failed:", err) }
}

// ---------------------------------------------------------------------------
// Manifest holen + Diff bilden
// ---------------------------------------------------------------------------
async function fetchRemoteManifest(manifestUrl){
    try{
        const response = await fetch(apiUrl(manifestUrl))
        if(!response.ok) return null
        const m = await response.json()
        if(!m || m.manifestVersion !== 1 || !Array.isArray(m.entries)) return null
        return m
    }
    catch(e){
        console.warn("downloadEngine: manifest fetch failed:", e.message)
        return null
    }
}

/**
 * Diff lokales vs. entferntes Manifest. Jeder Manifest-Pfad wird als NICHT vertrauenswürdig
 * behandelt und muss innerhalb des Installationsordners liegen (zip-slip-Äquivalent).
 * @returns {{ fetchList: any[], deleteList: string[] }}
 */
function diffManifests(localManifest, remoteManifest, installDir){
    const localByPath = new Map()
    if(localManifest && Array.isArray(localManifest.entries)){
        for(const e of localManifest.entries) localByPath.set(e.path, e)
    }
    const remotePaths = new Set()
    const fetchList = []
    for(const e of remoteManifest.entries){
        const target = path.resolve(installDir, e.path)
        if(!isPathInside(target, installDir)){
            throw new Error("manifest: refused entry outside install dir: " + e.path)
        }
        remotePaths.add(e.path)
        const local = localByPath.get(e.path)
        const onDisk = fs.existsSync(target)
        if(!local || local.sha256 !== e.sha256 || !onDisk) fetchList.push(e)
    }
    const deleteList = []
    for(const [p] of localByPath){
        if(!remotePaths.has(p)){
            const target = path.resolve(installDir, p)
            if(isPathInside(target, installDir)) deleteList.push(p)
        }
    }
    return { fetchList, deleteList }
}

// ---------------------------------------------------------------------------
// Manifest-Einträge laufweise laden, entpacken, verifizieren, platzieren
// ---------------------------------------------------------------------------
// Das Bündeln (rangePlanner.js) und das Wieder-Auftrennen (rangeReader.js) liegen bewusst in
// eigenen Dateien: beides rechnet mit Byte-Offsets in eine Zip-Datei hinein und ist dort ohne
// Electron testbar. Hier bleibt nur, was den Launcher-Zustand kennt (Pause, Abbruch, Fortschritt).

/**
 * Öffnet EINEN Range-Request und liefert die Antwort, sobald sie mit 206 beginnt.
 *
 * Die Statuseinteilung ist der Grund, warum das eine eigene Funktion ist: bis hierher galt jede
 * Antwort außer 206/403 als „Server hat Range ignoriert" und löste den Ganz-Zip-Fallback aus. Ein
 * `503 SlowDown` von R2 oder ein kurzer 502 hätte damit einen mehrere Gigabyte großen Neu-Download
 * ausgelöst, statt es schlicht noch einmal zu versuchen.
 */
function openRange(zipUrl, start, end){
    return new Promise((resolve, reject) => {
        const request = clientFor(zipUrl).get(zipUrl, { headers: { Range: `bytes=${start}-${end}` }, timeout: 0 }, (response) => {
            const code = response.statusCode
            if(code === 206) return resolve(response)
            response.resume()
            if(code === 403) return reject(new UrlExpiredError("403 auf die Objekt-Route"))
            if(code === 429 || code >= 500) return reject(new RetryableError("HTTP " + code))
            // 200 = Range wirklich ignoriert (alter Proxy). Alles andere ist ebenfalls nichts, was
            // ein Wiederholen heilt.
            return reject(new FallbackError("erwartet 206, bekommen " + code))
        })
        request.on("error", (err) => reject(cancelRequested ? new CancelledError("canceled") : err))
    })
}

/**
 * Lädt EINEN Lauf (zusammenhängender Byte-Bereich, ein Range-Request) und trennt ihn lokal wieder
 * in seine Einträge auf. `onEntryDone(entry)` läuft nach jedem fertig geschriebenen Eintrag, damit
 * der Fortschritt weiter je Datei persistiert wird und ein Abbruch nichts Fertiges verwirft.
 */
async function fetchRun(zipUrl, run, installDir, onEntryDone){
    const response = await openRange(zipUrl, run.start, run.end)
    currentDownloadResponse = response
    const reader = makeReader(response, { onProgress: progressAdd, beforeChunk: waitWhilePaused })
    try{
        await splitRun(reader, run, installDir, {
            beforeEntry: waitWhilePaused,
            onWriteStream: (s) => { currentDownloadWriteStream = s },
            onEntryDone,
        })
    }
    catch(err){
        if(cancelRequested) throw new CancelledError("canceled")
        // Ein zu früh endender Strom ist ein Netzproblem, kein Grund für den Ganz-Zip-Fallback.
        throw err instanceof ShortReadError ? new RetryableError(err.message) : err
    }
    finally{
        currentDownloadResponse = null
        currentDownloadWriteStream = null
        reader.close()
    }
}

// ---------------------------------------------------------------------------
// Delta-Lauf für den Kopf der Queue
// ---------------------------------------------------------------------------
async function runDelta(currentDownload, dl, remoteManifest){
    const installDir = currentDownload.installationPath + currentDownload.name + "/"
    await fs.promises.mkdir(installDir, { recursive: true })

    const localManifest = await readJson(localManifestPath(installDir))
    const { fetchList, deleteList } = diffManifests(localManifest, remoteManifest, installDir)

    // Resume-Zustand: bereits verifizierte Dateien dieses Builds überspringen.
    const prevState = await readJson(statePath(currentDownload.name))
    const doneSet = new Set()
    if(prevState && prevState.mode === "delta" && prevState.buildId === dl.buildId && Array.isArray(prevState.files)){
        for(const f of prevState.files){
            if(f.status === "done") doneSet.add(f.path)
        }
    }

    const pending = fetchList.filter(e => !(doneSet.has(e.path) && fs.existsSync(path.resolve(installDir, e.path))))
    const doneBytes = fetchList.filter(e => !pending.includes(e)).reduce((s, e) => s + e.compressedSize, 0)

    // Die offenen Einträge zu möglichst wenigen Range-Anfragen bündeln (siehe rangePlanner.js).
    // Bei einer Wiederaufnahme wird aus den RESTLICHEN Einträgen neu geplant — fertige Dateien
    // werden nie erneut geladen.
    const plan = planRanges(pending, remoteManifest.zipSizeBytes || 0)
    if(plan.mode === "whole-zip"){
        // Es lohnt sich nicht mehr zu stückeln: eine einzige Anfrage ist billiger und schneller.
        console.log("downloadEngine: delta covers most of the zip →", plan.reason, "- whole-zip instead")
        throw new FallbackError(plan.reason)
    }

    // Gesamtbytes = was WIRKLICH über die Leitung geht, also inklusive der bewusst mitgeladenen
    // unveränderten Lückenbytes. Sonst zeigte der Fortschritt über 100 %.
    const totalBytes = doneBytes + plan.payloadBytes + plan.wasteBytes
    progressReset(totalBytes, doneBytes)
    console.log("downloadEngine: delta for", currentDownload.name, "- fetch", pending.length, "of", remoteManifest.entries.length, "files in", plan.runs.length, "range requests (", plan.payloadBytes, "bytes +", plan.wasteBytes, "coalesced ),", plan.empty.length, "empty, delete", deleteList.length, doneSet.size ? "(resumed, " + doneSet.size + " already done)" : "")

    const state = {
        stateVersion: 1,
        descriptor: {
            id: currentDownload.id, name: currentDownload.name, title: currentDownload.title,
            installationPath: currentDownload.installationPath, thumbnail: currentDownload.thumbnail,
            categorie: currentDownload.categorie || "games",
        },
        gameId: currentDownload.id, buildId: dl.buildId, version: dl.version,
        mode: "delta",
        totalBytesToFetch: totalBytes, bytesDone: doneBytes,
        files: fetchList.map(e => ({ path: e.path, status: doneSet.has(e.path) ? "done" : "pending" })),
        deletes: deleteList,
        updatedAt: Date.now(),
    }
    const persist = async () => {
        state.bytesDone = progressDoneBytes
        state.updatedAt = Date.now()
        await writeJsonAtomic(statePath(currentDownload.name), state)
    }
    await persist()

    // Leere Dateien brauchen KEINE Anfrage — und dürfen auch keine bekommen: `Range: bytes=100-99`
    // ist ungültig, ein korrekter Server antwortet mit 416, und das galt hier bis eben als „Range
    // wird nicht unterstützt" → Ganz-Zip-Fallback wegen eines einzigen .gitkeep.
    for(const entry of plan.empty){
        const targetPath = path.resolve(installDir, entry.path)
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
        await fs.promises.writeFile(targetPath, "")
        if(entry.mode) await fs.promises.chmod(targetPath, entry.mode).catch(() => {})
        const f = state.files.find(x => x.path === entry.path)
        if(f) f.status = "done"
    }
    if(plan.empty.length > 0) await persist()

    const markDone = async (entry) => {
        const f = state.files.find(x => x.path === entry.path)
        if(f) f.status = "done"
        await persist()
    }

    // Signierte Zip-URL, die mitten im Lauf ablaufen kann. Sie wird VORAUSSCHAUEND erneuert (siehe
    // ensureFreshUrl) — jedes abgelaufene Exemplar kostete sonst eine vergebliche Anfrage, gegen R2
    // sogar eine bezahlte. Das 403 bleibt als Netz.
    const urlState = { url: apiUrl(dl.url), expiresAt: Number(dl.expiresAt) || 0, refreshes: 0, lastRefreshAt: 0 }

    /**
     * Holt eine frische signierte URL, wenn die aktuelle bald abläuft (oder `force`).
     * @returns "rediff", wenn zwischenzeitlich ein neuer Build veröffentlicht wurde.
     */
    const ensureFreshUrl = async (force) => {
        const now = Math.floor(Date.now() / 1000)
        if(!force && urlState.expiresAt && now < urlState.expiresAt - 60) return null
        // Der Zähler begrenzt nur unmittelbar aufeinanderfolgende Fehlschläge: eine frische URL, die
        // binnen Sekunden wieder abläuft, bedeutet Uhrendrift oder Fehlkonfiguration. Ein langer,
        // gesunder Download darf daran nicht sterben.
        if(force){
            if(Date.now() - urlState.lastRefreshAt < 5000){
                if(++urlState.refreshes > 5) throw new Error("Signierte Download-URL läuft wiederholt sofort ab — Download abgebrochen.")
            }
            else urlState.refreshes = 0
        }
        const fresh = await func.get("/v1/store/" + encodeURIComponent(currentDownload.id) + "/download-url", { token: session.getToken() })
        urlState.lastRefreshAt = Date.now()
        if(fresh.buildId !== dl.buildId) return "rediff"
        urlState.url = apiUrl(fresh.url)
        urlState.expiresAt = Number(fresh.expiresAt) || 0
        return null
    }

    /** Neuer Build mitten im Lauf → Zustand verwerfen und mit dem neuen Manifest von vorn. */
    const rediff = async () => {
        console.log("downloadEngine: build changed mid-download, rediffing")
        await fs.promises.rm(statePath(currentDownload.name), { force: true })
        const fresh = await func.get("/v1/store/" + encodeURIComponent(currentDownload.id) + "/download-url", { token: session.getToken() })
        const freshManifest = fresh.manifestUrl ? await fetchRemoteManifest(fresh.manifestUrl) : null
        if(!freshManifest || freshManifest.unsupported) throw new FallbackError("kein Manifest für den neuen Build")
        Object.assign(dl, fresh)
        return runDelta(currentDownload, dl, freshManifest)
    }

    /**
     * Beim Wiederholen eines Laufs nur noch die Einträge anfordern, die wirklich fehlen — sonst
     * lüden ein Abbruch kurz vor Ende des Laufs alle bereits geschriebenen Dateien erneut.
     */
    const stillOpen = (run) => {
        const open = run.entries.filter(e => {
            const f = state.files.find(x => x.path === e.path)
            return !f || f.status !== "done"
        })
        if(open.length === 0) return null
        return { start: open[0].offset, end: open[open.length - 1].offset + open[open.length - 1].compressedSize - 1, entries: open }
    }

    for(const run of plan.runs){
        await waitWhilePaused()
        let attempts = 0
        for(;;){
            const todo = stillOpen(run)
            if(!todo) break
            try{
                if((await ensureFreshUrl(false)) === "rediff") return await rediff()
                await fetchRun(urlState.url, todo, installDir, markDone)
                break
            }
            catch(err){
                if(err instanceof CancelledError || err instanceof FallbackError) throw err
                if(err instanceof UrlExpiredError){
                    if((await ensureFreshUrl(true)) === "rediff") return await rediff()
                    continue
                }
                // 429/5xx und abgerissene Verbindungen: erneut versuchen statt das ganze Zip zu holen.
                attempts++
                if(attempts >= 3) throw err
                console.warn("downloadEngine: retrying range", run.start + "-" + run.end, "after:", err.message)
                await sleep(1000 * attempts)
            }
        }
    }

    // Gelöschte Dateien entfernen + leere Verzeichnisse aufräumen, Manifest-Verzeichnisse anlegen.
    for(const p of deleteList){
        await fs.promises.rm(path.resolve(installDir, p), { force: true }).catch(() => {})
    }
    if(Array.isArray(remoteManifest.dirs)){
        for(const d of remoteManifest.dirs){
            const target = path.resolve(installDir, d.path)
            if(!isPathInside(target, installDir)) continue
            await fs.promises.mkdir(target, { recursive: true })
            if(d.mode) await fs.promises.chmod(target, d.mode).catch(() => {})
        }
    }
    await pruneEmptyDirs(installDir)

    // Metadaten für Registry/Update-Check.
    currentDownload.version = dl.version
    currentDownload.buildId = dl.buildId
    currentDownload.sha256 = dl.sha256
    await finishInstall(currentDownload, installDir, remoteManifest)
}

async function pruneEmptyDirs(root){
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
    for(const e of entries){
        if(!e.isDirectory()) continue
        const dir = path.join(root, e.name)
        await pruneEmptyDirs(dir)
        const rest = await fs.promises.readdir(dir).catch(() => ["x"])
        if(rest.length === 0) await fs.promises.rmdir(dir).catch(() => {})
    }
}

// ---------------------------------------------------------------------------
// Ganz-Zip-Fallback (bisheriger Pfad) — jetzt mit Byte-Resume
// ---------------------------------------------------------------------------
function runWholeZip(currentDownload, dl){
    const buildUrl = apiUrl(dl.url)
    const downloadPath = config.downloads + currentDownload.name + config.packageExt
    return new Promise(async (resolve, reject) => {
      try{
        // Byte-Resume: passt ein vorhandenes Teil-Zip zum selben Build, ab dessen Ende weiterladen.
        let resumeFrom = 0
        const prevState = await readJson(statePath(currentDownload.name))
        if(prevState && prevState.mode === "wholezip" && prevState.buildId === dl.buildId){
            const stat = await fs.promises.stat(downloadPath).catch(() => null)
            if(stat && stat.isFile() && stat.size > 0) resumeFrom = stat.size
        }
        const state = {
            stateVersion: 1,
            descriptor: {
                id: currentDownload.id, name: currentDownload.name, title: currentDownload.title,
                installationPath: currentDownload.installationPath, thumbnail: currentDownload.thumbnail,
                categorie: currentDownload.categorie || "games",
            },
            gameId: currentDownload.id, buildId: dl.buildId, version: dl.version,
            mode: "wholezip",
            totalBytesToFetch: dl.sizeBytes || 0, bytesDone: resumeFrom,
            files: [], deletes: [],
            updatedAt: Date.now(),
        }
        await writeJsonAtomic(statePath(currentDownload.name), state)

        const headers = resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : {}
        clientFor(buildUrl).get(buildUrl, { headers, sessionTimeout: 0, timeout: 0 }, (response) => {
            // 401/403/404 → keine berechtigte Auslieferung; sauber abbrechen statt HTML als "zip" zu speichern.
            if(response.statusCode && response.statusCode >= 400){
                console.error("download: server rejected build fetch, status", response.statusCode)
                response.resume()
                return reject(new Error(response.statusCode === 403 ? "Du besitzt dieses Spiel nicht (oder deine Sitzung ist abgelaufen)." : "Der Build konnte nicht geladen werden (Status " + response.statusCode + ")."))
            }
            // 200 trotz Range → Server unterstützt kein Resume → von vorn (Datei überschreiben).
            const appending = resumeFrom > 0 && response.statusCode === 206
            if(resumeFrom > 0 && !appending) resumeFrom = 0

            currentDownloadResponse = response
            if(pauseRequested) response.pause()
            const writeStream = fs.createWriteStream(downloadPath, appending ? { flags: "a" } : {})
            currentDownloadWriteStream = writeStream
            response.pipe(writeStream)

            const totalBytes = (parseInt(response.headers["content-length"], 10) || 0) + resumeFrom
            progressReset(totalBytes, resumeFrom)
            response.on("data", (chunk) => progressAdd(chunk.length))
            response.on("error", (err) => {
                writeStream.destroy()
                reject(cancelRequested ? new CancelledError("canceled") : err)
            })

            writeStream.on("finish", async () => {
              try{
                writeStream.close()
                if(!currentDownloadResponse || !currentDownloadWriteStream) return
                currentDownloadResponse = null
                currentDownloadWriteStream = null
                console.log("download:", "completed for", currentDownload.name)

                // Verify package integrity before we unpack and (auto-)run it.
                const expected = expectedChecksum(currentDownload) || dl.sha256
                if(expected){
                    const actual = await sha256File(downloadPath)
                    if(actual.toLowerCase() !== expected.toLowerCase()){
                        console.error("download: checksum mismatch for", currentDownload.name, "expected", expected, "got", actual)
                        await func.remove(downloadPath)
                        await fs.promises.rm(statePath(currentDownload.name), { force: true }).catch(() => {})
                        return reject(new Error("Die Integritätsprüfung (SHA-256) für " + currentDownload.name + " ist fehlgeschlagen. Die Datei wurde aus Sicherheitsgründen verworfen."))
                    }
                    console.log("download: checksum verified for", currentDownload.name)
                }
                else console.warn("download: no checksum provided for", currentDownload.name, "- skipping integrity verification")

                const installDir = currentDownload.installationPath + currentDownload.name + "/"
                console.log("unpackage:", "started unpacking for", currentDownload.name)
                await safeExtract(downloadPath, installDir)
                console.log("unpackage:", "finished unpacking", currentDownload.name)
                await func.remove(downloadPath)

                currentDownload.version = dl.version
                currentDownload.buildId = dl.buildId
                currentDownload.sha256 = dl.sha256
                // Manifest (falls verfügbar) verbatim persistieren — der Zip-Hash wurde geprüft,
                // Inhalt ist identisch. Damit ist das NÄCHSTE Update ein echtes Delta.
                const remoteManifest = dl.manifestUrl ? await fetchRemoteManifest(dl.manifestUrl) : null
                await finishInstall(currentDownload, installDir, remoteManifest)
                resolve()
              }
              catch(err){
                // Entpacken fehlgeschlagen (z.B. zip-slip) — Paket verwerfen, nichts installieren.
                console.error("download: failed while finishing", currentDownload && currentDownload.name, err)
                try{ await func.remove(downloadPath) } catch(e){ /* best effort */ }
                await fs.promises.rm(statePath(currentDownload.name), { force: true }).catch(() => {})
                reject(new Error("Das Paket konnte nicht sicher entpackt werden und wurde verworfen."))
              }
            })
            writeStream.on("error", (err) => reject(cancelRequested ? new CancelledError("canceled") : err))
        }).on("error", (err) => reject(cancelRequested ? new CancelledError("canceled") : err))
      }
      catch(err){ reject(err) }
    })
}

// ---------------------------------------------------------------------------
// Haupt-Schleife
// ---------------------------------------------------------------------------
async function download(){
    try{
        let status = await func.checkInternetConnection()
        if(status == 1){
            console.log("download: failed, because of no connection to the api.sketch-company.de server")
            await func.showErrorBox("Download failed", "The download failed, because there was no connection to the api.sketch-company.de server.")
            await func.redirect("/store")
            return
        }
        else if(status == 0){
            console.log("download: failed, because there is no internet connection")
            await func.showErrorBox("Download failed", "The download failed, because there was no connection to the internet.")
            func.redirect("/store")
            return
        }
        else console.log("download: connection established")

        if(downloadQueue.length === 0 || isDownloading) return
        resetDownloadState()
        isDownloading = true
        cancelRequested = false
        queueAdvancedByCancel = false
        const currentDownload = downloadQueue[0]
        console.log("download:", "started download for", currentDownload.name)
        let succeeded = false

        try{
            // Signierte, kurzlebige Download-URL lizenzgeprüft holen (KEIN Auth-Header auf /builds).
            let dl
            try{
                dl = await func.get("/v1/store/" + encodeURIComponent(currentDownload.id) + "/download-url", { token: session.getToken() })
            }
            catch(err){
                const msg = (err && err.status === 401) ? "Sitzung abgelaufen. Bitte melde dich neu an."
                    : (err && (err.status === 403 || err.code === "NO_LICENSE")) ? "Du besitzt dieses Spiel nicht."
                    : (err && (err.status === 404 || err.code === "NO_BUILD")) ? "Für dieses Spiel ist noch kein Build verfügbar."
                    : "Die Download-URL konnte nicht erstellt werden."
                if(err && err.status === 401) session.clearSession()
                throw new Error(msg)
            }
            if(!currentDownload.sha256 && dl.sha256) currentDownload.sha256 = dl.sha256

            // Delta, wenn ein brauchbares Manifest existiert — sonst Ganz-Zip.
            const remoteManifest = dl.manifestUrl ? await fetchRemoteManifest(dl.manifestUrl) : null
            if(remoteManifest && !remoteManifest.unsupported){
                try{
                    await runDelta(currentDownload, dl, remoteManifest)
                }
                catch(err){
                    if(err instanceof FallbackError){
                        console.warn("downloadEngine: delta failed (", err.message, ") → whole-zip fallback")
                        await runWholeZip(currentDownload, dl)
                    }
                    else throw err
                }
            }
            else{
                if(remoteManifest && remoteManifest.unsupported) console.log("downloadEngine: manifest marked unsupported → whole-zip")
                await runWholeZip(currentDownload, dl)
            }
            succeeded = true
            console.log("download:", "finished", currentDownload.name)
        }
        catch(err){
            if(err instanceof CancelledError){
                console.log("download:", "canceled", currentDownload.name)
            }
            else{
                // Zustand bleibt für Crash/Netzabbruch erhalten (Resume beim nächsten Start).
                console.error("download:", err)
                func.showErrorBox("Download fehlgeschlagen", err.message || String(err)).catch(() => {})
                // Persistente Fehler-Benachrichtigung (überlebt Neustart) + OS-Toast.
                try{
                    const gid = String(currentDownload.id || currentDownload.name || "")
                    await notificationStore.add({
                        key: "download-failed:" + gid,
                        type: "error",
                        title: "Download fehlgeschlagen",
                        message: `${currentDownload.title || currentDownload.name} konnte nicht installiert werden.`,
                        actions: gid ? [{ kind: "navigate", to: "/store/" + encodeURIComponent(gid), label: "Erneut versuchen" }] : undefined,
                    }, { os: true })
                }
                catch(nerr){ console.error("download: failure notification failed:", nerr) }
            }
        }
        finally{
            currentDownloadResponse = null
            currentDownloadWriteStream = null
            if(!queueAdvancedByCancel && downloadQueue.length > 0) downloadQueue.splice(0, 1)
            console.log("download:", "removed from downloadQueue", downloadQueue)
            resetDownloadState()
            // Wie bisher: nach Erfolg bleibt 100 stehen, bis die UI resettet oder der
            // nächste Download beginnt (der 99→0→100-Flip in getProgress deckt den Rest ab).
            if(succeeded) downloadProgress = 100
            if(downloadQueue.length > 0) download()
        }
    }
    catch(err){
        console.error("download:", err)
        resetDownloadState()
    }
}

// ---------------------------------------------------------------------------
// Öffentliche Schnittstelle (von den /api-Endpunkten genutzt)
// ---------------------------------------------------------------------------
function enqueue(descriptor){
    downloadQueue.push(descriptor)
    if(!isDownloading) download()
    return downloadQueue
}
function getQueue(){ return downloadQueue }
function unqueue(index){ downloadQueue.splice(index, 1); return downloadQueue }
function move(index, to){ downloadQueue.splice(to, 0, downloadQueue.splice(index, 1)[0]); return downloadQueue }
function isActive(){ return isDownloading }

function pause(){
    if(!isDownloading) return { ok: false, message: "Kein aktiver Download." }
    if(pauseRequested) return { ok: false, message: "Der Download ist bereits pausiert." }
    pauseRequested = true
    if(currentDownloadResponse && !currentDownloadResponse.isPaused()) currentDownloadResponse.pause()
    return { ok: true, message: "Der Download wurde pausiert." }
}
function resume(){
    if(!isDownloading) return { ok: false, message: "Kein aktiver Download." }
    if(!pauseRequested) return { ok: false, message: "Der Download ist nicht pausiert und kann nicht fortgesetzt werden." }
    pauseRequested = false
    if(currentDownloadResponse && currentDownloadResponse.isPaused()) currentDownloadResponse.resume()
    return { ok: true, message: "Der Download wurde fortgesetzt." }
}
/**
 * Expliziter Nutzer-Abbruch: verwirft Resume-Zustand + Teilstücke BEWUSST
 * (Resume über Neustarts gilt nur für Crash/Netzabbruch/Beenden, nicht für Cancel).
 */
async function cancel(){
    if(!isDownloading || downloadQueue.length === 0) return { ok: false, message: "Kein aktiver Download." }
    const current = downloadQueue[0]
    cancelRequested = true
    pauseRequested = false
    if(currentDownloadResponse) currentDownloadResponse.destroy()
    if(currentDownloadWriteStream) currentDownloadWriteStream.destroy()
    // Queue sofort weiterrücken (die Schleife erkennt das über queueAdvancedByCancel).
    downloadQueue.splice(0, 1)
    queueAdvancedByCancel = true
    // Aufräumen: Zustand, Teil-Zip und .sgl-part-Reste.
    await fs.promises.rm(statePath(current.name), { force: true }).catch(() => {})
    await func.remove(config.downloads + current.name + config.packageExt).catch(() => {})
    try{
        const installDir = current.installationPath + current.name + "/"
        await removePartFiles(installDir)
    } catch(e){ /* best effort */ }
    return { ok: true, message: "Download abgebrochen." }
}
async function removePartFiles(root){
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
    for(const e of entries){
        const p = path.join(root, e.name)
        if(e.isDirectory()) await removePartFiles(p)
        else if(e.name.endsWith(".sgl-part")) await fs.promises.rm(p, { force: true }).catch(() => {})
    }
}

function getProgress(){
    // 99→0→100-Flip: nach Abschluss einmal 100 melden, damit die UI den Balken schließt.
    if(lastDownloadProgress == 99 && downloadProgress == 0){
        lastDownloadProgress = downloadProgress
        return { percentage: 100, time: downloadTime, speed: downloadSpeed }
    }
    lastDownloadProgress = downloadProgress
    return { percentage: downloadProgress, time: downloadTime, speed: downloadSpeed }
}
function getState(){
    return { paused: pauseRequested || !!(currentDownloadResponse && currentDownloadResponse.isPaused()) }
}
function resetProgress(){
    downloadProgress = 0
    downloadSpeed = 0
    downloadSize = 0
    downloadTime = { hours: 0, minutes: 0, seconds: 0 }
}
function getSize(){ return downloadSize }

/**
 * Beim Start (Hintergrund): unterbrochene Downloads anhand der State-Dateien wieder einreihen.
 * Nur mit gültiger Session (Download-URL/Manifest brauchen sie); Duplikate werden übersprungen.
 */
async function resumeInterrupted(){
    try{
        if(!session.isLoggedIn()) return
        const files = await fs.promises.readdir(config.downloads).catch(() => [])
        for(const f of files){
            if(!f.endsWith(".state.json")) continue
            const state = await readJson(config.downloads + f)
            if(!state || !state.descriptor || !state.descriptor.id) continue
            if(downloadQueue.some(q => q.id === state.descriptor.id)) continue
            console.log("downloadEngine: resuming interrupted download:", state.descriptor.name)
            enqueue({ ...state.descriptor })
        }
    }
    catch(err){
        console.error("resumeInterrupted:", err)
    }
}

module.exports = {
    enqueue, getQueue, unqueue, move, isActive,
    pause, resume, cancel,
    getProgress, getState, getSize, resetProgress,
    resumeInterrupted,
    getDirectorySize, sha256File, safeExtract,
}
