const router = require("express").Router()
const bodyParser = require("body-parser")
const func = require("./functions")
const path = require("path")
const { shell } = require("electron")
const config = require("./launcherConfig")
const session = require("./session")
// Lokaler Spiegel der Lizenzen (wem gehört welche Installation?) — siehe ownership.js.
const ownership = require("./ownership")
const storeAdapter = require("./storeAdapter")
const { apiUrl } = require("./apiBase")
// Download-/Update-Pipeline (Delta + Resume + Ganz-Zip-Fallback) — siehe downloadEngine.js.
const engine = require("./downloadEngine")
const getDirectorySize = engine.getDirectorySize
// Persistenter Benachrichtigungs-Store (Glocken-Fenster) — geteilt mit downloadEngine/index.
const notificationStore = require("./notificationStore")
// Social-Login über den Systembrowser (Loopback-OAuth).
const oauthLoopback = require("./oauthLoopback")
// Ursachen-Codes des OAuth-Flows → deutsche Nutzer-Meldungen.
const oauthErrors = require("./oauthErrors")

router.use(bodyParser.json())

// Lokales Playtime-Tracking (Basis fürs 15-Min-Review-Gate). In-Memory-Startzeiten je Spiel;
// beim Prozess-Ende wird die (gedeckelte) Sitzungsdauer in playtimesFile aufsummiert.
const playSessions = new Map()
async function addPlaytime(gameId, seconds){
    let map = {}
    try{ map = JSON.parse(await func.read(config.playtimesFile)) }catch{ map = {} }
    const rec = map[gameId] || { seconds: 0, sessions: 0, lastPlayed: 0 }
    rec.seconds = (rec.seconds || 0) + seconds
    rec.sessions = (rec.sessions || 0) + 1
    rec.lastPlayed = Date.now()
    map[gameId] = rec
    await func.write(config.playtimesFile, JSON.stringify(map, null, 3))
}

// --- security helpers -------------------------------------------------------
/**
 * Returns true if ```child``` resolves to a path strictly inside ```parent```.
 * Used to make sure we never operate on paths outside of a product's own
 * installation directory (defense against tampered registry / traversal).
 */
function isPathInside(child, parent){
    if(!child || !parent) return false
    const rel = path.relative(path.resolve(parent), path.resolve(child))
    return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel)
}
/**
 * Cross-platform path equality (normalizes separators / `.` / `..` segments).
 * Replaces the previous Windows-only backslash string comparisons.
 */
function samePath(a, b){
    if(!a || !b) return false
    return path.resolve(a) === path.resolve(b)
}

// --- lightweight input validation -------------------------------------------
function isNonEmptyString(v){ return typeof v === "string" && v.length > 0 }
function isIndexInRange(v, length){ return Number.isInteger(v) && v >= 0 && v < length }
/**
 * Resolves a product from the trusted ```installsFile``` registry by ```name```
 * and/or by matching its registered ```start``` path. Requests must never cause
 * the launcher to execute or delete an arbitrary path supplied by the caller —
 * only paths that are recorded in the registry are ever acted upon.
 * Zusätzlich hängt am Fund der Besitz: eine Installation gehört nur dem Konto, das eine Lizenz
 * dafür hat (ownership.js). Mit ```requireOwned``` (Default true) liefern die privilegierten
 * Routen für fremde Spiele kein Produkt — nur Löschen/Cover kommen bewusst ohne Lizenz aus.
 * @returns {Promise<{product: object|null, categorie?: string, installs: object, notOwned?: boolean}>}
 */
async function resolveRegisteredProduct({ name, filepath, requireOwned = true } = {}){
    const installs = JSON.parse(await func.read(config.installsFile))
    // Nur noch Spiele — die frühere `softwares`-Kategorie ist entfernt; alte Registry-Dateien
    // dürfen den Schlüssel noch enthalten (wird ignoriert).
    const all = installs.games.map(p => ({ p, c: "games" }))
    let match
    if(name) match = all.find(x => x.p.name === name)
    if(!match && filepath) match = all.find(x => x.p.start && path.resolve(x.p.start) === path.resolve(filepath))
    if(!match) return { product: null, installs }
    if(requireOwned && !ownership.owns(match.p.name)) return { product: null, notOwned: true, installs }
    return { product: match.p, categorie: match.c, installs }
}

// Store-Katalog über die neue v1-GraphQL-API (siehe storeAdapter.js). Der Renderer erhält die
// NEUE Form { categories:[{key,title,games}], games:[...] } mit Preis/Besitz — nicht mehr die
// tote Legacy-Form (populars/suggestions/softwares mit level/platform). Der Store braucht jetzt
// eine Session (die ganze API ist nicht mehr anonym). ACHTUNG: Store.jsx muss auf die neue Form
// angepasst werden (Follow-up, siehe V1-MIGRATION.md).
router.get("/store", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Bitte melde dich an, um den Store zu sehen." })
        // ?force=1 (Renderer-Refresh-Knopf) umgeht den 60s-In-Process-Cache des storeAdapters.
        const store = await storeAdapter.getStore(token, { force: !!req.query.force })
        res.json({ status: 1, data: { ...store, platform: process.platform } })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// --- Wunschliste (server-seitig, geteilte Tabelle mit der Web-App) ---
router.get("/wishlist", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.get("/v1/wishlist", { token })
        res.json({ status: 1, data })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen." }) }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
router.post("/wishlist", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const gameId = req.body && req.body.gameId
        if(!isNonEmptyString(gameId)) return res.json({ status: 0, data: "Ungültige Spiel-Id." })
        if(req.body.remove) await func.send("/v1/wishlist/" + encodeURIComponent(gameId), {}, { token, method: "DELETE" })
        else await func.send("/v1/wishlist", { gameId }, { token })
        res.json({ status: 1, data: "ok" })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})

// --- Reviews & Bewertung (Detailseite) ---
router.get("/store/:id/reviews", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        // Query durchreichen: ?mode=overview ODER ?offset=&limit= (Rezensionen-Seite/Produktseite).
        const qs = new URLSearchParams()
        if(req.query.mode) qs.set("mode", String(req.query.mode))
        if(req.query.offset != null) qs.set("offset", String(req.query.offset))
        if(req.query.limit != null) qs.set("limit", String(req.query.limit))
        const suffix = qs.toString() ? "?" + qs.toString() : ""
        const data = await func.get("/v1/store/" + encodeURIComponent(req.params.id) + "/reviews" + suffix, { token })
        res.json({ status: 1, data })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen." }) }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Rezension abgeben/bearbeiten (Empfehlung + Text ≥ 40 Zeichen; Stunden aus lokaler Spielzeit).
router.post("/store/:id/review", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.send("/v1/store/" + encodeURIComponent(req.params.id) + "/review", { recommended: req.body.recommended, text: req.body.text, hoursPlayed: req.body.hoursPlayed }, { token })
        res.json({ status: 1, data })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen." }) }
        if(err instanceof func.ApiError) return res.json({ status: 0, data: err.message || err.toString() })
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Lokale Spielzeit eines Spiels (für das 15-Min-Review-Gate auf der Produktseite).
router.get("/playtime/:id", async (req, res) => {
    try{
        let map = {}
        try{ map = JSON.parse(await func.read(config.playtimesFile)) }catch{ map = {} }
        const rec = map[req.params.id]
        res.json({ status: 1, data: { seconds: rec?.seconds || 0 } })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})

// --- Entwickler-/Studio-Profil (Detailseite /studio/:slug) ---
// Relative Medienpfade gegen die API-Basis absolutisieren (Avatar/Banner/Section-Bilder), sonst
// laden Cover/Banner nicht (SPA-Origin liefert sie nicht). Spiele über storeAdapter absolutisieren.
router.get("/studio/:slug", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.get("/v1/studio/" + encodeURIComponent(req.params.slug), { token })
        const absStr = (v) => (typeof v === "string" && v.startsWith("/") ? apiUrl(v) : v)
        // Block-Arrays rekursiv absolutisieren (figure.src, image-banner.imagePath, verschachtelte about-text.blocks).
        const absBlocks = (blocks) => Array.isArray(blocks) ? blocks.map(b => {
            if(!b || typeof b !== "object") return b
            const nb = { ...b }
            if(typeof nb.src === "string") nb.src = absStr(nb.src)
            if(typeof nb.imagePath === "string") nb.imagePath = absStr(nb.imagePath)
            if(Array.isArray(nb.blocks)) nb.blocks = absBlocks(nb.blocks)
            return nb
        }) : blocks
        if(data && data.studio){
            data.studio.avatarPath = absStr(data.studio.avatarPath)
            data.studio.bannerPath = absStr(data.studio.bannerPath)
            data.studio.homepageSections = absBlocks(data.studio.homepageSections)
            data.studio.aboutContent = absBlocks(data.studio.aboutContent)
        }
        if(data && Array.isArray(data.games)) data.games = data.games.map(g => storeAdapter.absolutizeMedia(g))
        res.json({ status: 1, data })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
        if(err instanceof func.ApiError && err.status === 404) return res.json({ status: 0, data: "Studio nicht gefunden." })
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Hinweis: der Proxy POST /store/rate (1–5 Sterne) ist mit P5 entfallen. Bewertet wird
// ausschließlich über die Rezension mit Daumen hoch/runter — siehe POST /store/:id/review oben.

router.get("/request-and-cache", async (req, res) => {
    try{
        const url = req.query.url
        const response = await func.getAndCache(url, 30)
        res.json({
            status: 1,
            data: response
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})

router.post("/browser", async (req, res) => {
    try{
        // Only allow opening web URLs in the external browser (not file:// or
        // other schemes that shell.openExternal would otherwise honor).
        const raw = req.body.href || req.body.url
        let parsed
        try{ parsed = new URL(raw) }
        catch(e){ parsed = null }
        if(!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")){
            console.error(req.path, "refused to open non-web url:", raw)
            return res.json({ status: 0, data: "Ungültige URL." })
        }
        await func.openExternal(parsed.href)
        console.log(req.path, "opened browser at " + parsed.href)
        res.json({
            status: 1,
            data: "opened browser"
        })
    }
    catch(err){
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})

router.get("/patch-notes", async (req, res) => {
    try{
        const data = await func.getRepository()
        res.json({
            status: 1,
            data
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})

router.get("/close-for-update", (req, res) => {
    try{
        console.log(req.path, "launcher was closed by another application (launcher):", req)
        // Auto-Update-Übernahme: die alte Instanz muss WIRKLICH beenden (nicht ins Tray verstecken).
        setTimeout(() => func.quitLauncher(), 10)
        res.json({
            status: 1,
            data: "closed"
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
// Launcher ins Tray/den Hintergrund verstecken (Kontextmenü „Schließen") — läuft weiter.
router.post("/window/hide", (req, res) => {
    try{
        func.hideToBackground()
        res.json({ status: 1, data: "hidden" })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})

router.post("/settings/move", async (req, res) => {
    try{
        const installs = JSON.parse(await func.read(config.installsFile))
        const { oldInstallationPath, newInstallationPath } = req.body

        // Move every product that was installed in the old installation path to
        // the new one. Path comparison is done cross-platform via samePath().
        async function moveCategory(list, label){
            if(!list || list.length === 0){
                console.log(req.path, "there are no", label, "installed to move")
                return
            }
            for(const element of list){
                if(samePath(element.installationPath, oldInstallationPath)){
                    const targetDir = path.join(newInstallationPath, element.name)
                    console.log(req.path, "moving", label, element.name, "to", targetDir)
                    await func.move(path.dirname(element.start), targetDir)
                    element.start = path.join(targetDir, element.name + config.appExt)
                    element.installationPath = newInstallationPath.endsWith(path.sep) ? newInstallationPath : newInstallationPath + path.sep
                }
            }
        }

        await moveCategory(installs.games, "games")

        await func.write(config.installsFile, JSON.stringify(installs, null, 3))

        res.json({
            status: 1,
            data: "successfully moved products to new directory"
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.get("/settings/open", async (req, res) => {
    try{
        const result = await func.showDialog()
        console.log(req.path, "result", result)
        res.json({
            status: 0,
            data: result
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.get("/updates/clear", async (req, res) => {
    try{
        if(req.query.name){
            const updates = JSON.parse(await func.read(config.updatesFile)).updates
            for (let i = 0; i < updates.length; i++) {
                const element = updates[i];
                if(element.name == req.query.name){
                    updates.splice(i, 1)
                    await func.write(config.updatesFile, JSON.stringify({updates}, null, 3))
                    console.log(req.path, "deleted " + req.query.name + " from updates file")
                    break
                }
            }
            res.json({
                status: 1,
                data: "deleted " + req.query.name + " from updates file"
            })
        }
        else{
            await func.write(config.updatesFile, JSON.stringify({updates: []}, null, 3))
            res.json({
                status: 1,
                data: "cleaned updates file"
            })
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.get("/updates/pull", async (req, res) => {
    try{
        const status = await func.checkInternetConnection()

        if(status == 2){
            // Gelegenheit mitnehmen: der Besitz-Spiegel bestimmt, welche Installationen überhaupt
            // auf Updates geprüft werden — also vorher auffrischen.
            const token = session.getToken()
            if(token) await ownership.sync(token, session.getUserId())
            // Single source of truth for the update-check logic (shared with the
            // startup check), instead of duplicating it here.
            const updates = await config.checkForUpdates()
            res.json({
                status: 1,
                data: updates
            })
        }
        else if(status == 1){
            res.json({
                status: 0,
                data: "Keine Verbindung zum Server."
            })
        }
        else{
            res.json({
                status: 0,
                data: "Keine Internetverbindung."
            })
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.get("/updates", async (req, res) => {
    try{
        const updates = JSON.parse(await func.read(config.updatesFile))
        res.json({
            status: 1,
            data: updates
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})

// Benachrichtigungen: delegieren an den persistenten Store (notificationStore.js).
// Erlaubte Aktions-Typen (Allowlist) — nur deklarative Daten, nie Callbacks (RCE-Schutz).
const NOTIF_ACTION_KINDS = ["play", "navigate", "openFolder", "updateGame", "retryDownload"]
function sanitizeAction(a) {
    if (!a || typeof a !== "object") return null
    if (!NOTIF_ACTION_KINDS.includes(a.kind)) return null
    const out = { kind: a.kind, label: String(a.label || "") }
    // Nur bekannte String-Felder übernehmen (keine Objekte/Funktionen).
    for (const k of ["gameId", "start", "title", "to"]) {
        if (typeof a[k] === "string") out[k] = a[k]
    }
    return out
}

router.get("/notifications", async (req, res) => {
    res.json({ status: 1, data: await notificationStore.list() })
})
router.post("/notifications/add", async (req, res) => {
    const { title, message, type, actions, key, pinned } = req.body || {}
    const cleanActions = Array.isArray(actions) ? actions.map(sanitizeAction).filter(Boolean) : undefined
    const n = await notificationStore.add({
        title: typeof title === "string" ? title : "",
        message: typeof message === "string" ? message : "",
        type: typeof type === "string" ? type : "note",
        ...(cleanActions && cleanActions.length ? { actions: cleanActions } : {}),
        ...(typeof key === "string" ? { key } : {}),
        ...(pinned ? { pinned: true } : {}),
    })
    res.json({ status: 1, data: n })
})
router.post("/notifications/remove", async (req, res) => {
    await notificationStore.remove(req.body?.id)
    res.json({ status: 1, data: await notificationStore.list() })
})
router.post("/notifications/removeAll", async (req, res) => {
    await notificationStore.removeAll()
    res.json({ status: 1, data: await notificationStore.list() })
})
router.post("/notifications/read", async (req, res) => {
    await notificationStore.markAllRead()
    res.json({ status: 1, data: await notificationStore.list() })
})
router.get("/lastplayed", async (req, res) => {
    try{
        const installs = JSON.parse(await func.read(config.installsFile))
        const lastPlayed = installs.other[0]
        // Gehört das zuletzt gespielte Spiel nicht dem angemeldeten Konto, gibt es hier nichts zu
        // zeigen (die Startseite behandelt null als „noch kein Spiel gespielt").
        res.json({
            status: 1,
            data: lastPlayed && ownership.owns(lastPlayed.name) ? lastPlayed : null
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.post("/settings", async (req, res) => {
    try{
        if(!req.body || typeof req.body !== "object"){
            console.error(req.path, "rejected settings with unexpected shape")
            return res.json({ status: 0, data: "Ungültige Einstellungen." })
        }
        // Auf die bekannte Form normalisieren: nur bekannte Keys, unbekannte (z. B. das reine
        // Anzeige-Feld `version` vom GET, oder Manipulationsversuche) werden verworfen, fehlende
        // mit Defaults gefüllt. So schlägt das Speichern nicht mehr an einem Extra-Key fehl.
        const clean = config.sanitizeSettings(req.body)
        await func.write(config.settingsFile, func.encrypt(JSON.stringify(clean, null, 3)))
        console.log(req.path, "saved settings")
        res.json({
            status: 1,
            data: "Änderungen erfolgreich gespeichert."
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.get("/settings", async (req, res) => {
    try{
        const version = require("../package.json").version
        const settings = JSON.parse(func.decrypt(await func.read(config.settingsFile)))
        settings.version = version
        res.json({
            status: 1,
            data: settings
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.post("/account/update", async (req, res) => {
    try{
        const token = session.getToken()
        const id = session.getUserId()
        if(!token || !id) return res.json({ status: 0, data: "Nicht angemeldet." })
        if(await func.checkInternetConnection() != 2){
            return res.json({ status: 0, data: "Keine Verbindung zum Server." })
        }
        // Eindeutigkeit prüfen, dann Profil aktualisieren (Bearer). Ein Passwortwechsel läuft NICHT
        // hierüber (das schriebe den Wert verbatim) — dafür gibt es change-password.
        // Die Konto-Id leitet die API in beiden Aufrufen aus dem Token ab; sie steht bewusst nicht
        // mehr im Body (der alte /u/-Dispatcher hat sie von dort gelesen).
        const availability = await func.send("/v1/account/profile/availability", { username: req.body.user, email: req.body.email }, { token })
        if(!availability || !availability.available){
            return res.json({ status: 0, data: "Ein Benutzer mit diesen Daten existiert bereits. Ändere sie und versuch es nochmal." })
        }
        await func.send("/v1/account/profile", { username: req.body.user, email: req.body.email }, { token, method: "patch" })
        res.json({ status: 1, data: "Änderungen gespeichert." })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
router.get("/account/logout", async (req, res) => {
    try{
        const token = session.getToken()
        // Session serverseitig sperren (best effort), dann lokal löschen.
        if(token) await func.send("/v1/auth/logout", {}, { token }).catch(() => {})
        session.clearSession()
        // Besitz-Spiegel NICHT löschen: ohne Session gilt der Stand des zuletzt angemeldeten
        // Kontos, damit „Offline spielen" nach dem Abmelden weiter die richtigen Spiele zeigt.
        // Nur den In-Memory-Stand verwerfen, damit der nächste Login frisch liest.
        ownership.invalidate()
        // Legacy-Nutzerdatei (Passwort!) entfernen, falls noch vorhanden.
        if(func.exists(config.userFile)) await func.remove(config.userFile).catch(() => {})
        res.json({
            status: 1,
            data: "Abgemeldet"
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }})
// Schritt 1 der Registrierung: Bestätigungscode an die E-Mail senden (v1 verlangt eine
// verifizierte E-Mail VOR der Kontoerstellung). Der Renderer zeigt danach das Code-Eingabefeld.
router.post("/account/verify", async (req, res) => {
    try{
        if(await func.checkInternetConnection() != 2){
            return res.json({ status: 0, data: "Um einen Account zu erstellen brauchst du eine Internetverbindung." })
        }
        await func.send("/v1/auth/verify", { username: req.body.user, email: req.body.email })
        res.json({ status: 1, data: "E-Mail gesendet" })
    }
    catch(err){
        if(err instanceof func.ApiError) return res.json({ status: 0, data: err.message })
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Schritt 2: Konto mit dem E-Mail-Code anlegen. Klartext-Passwort über HTTPS (kein client-AES).
// Bei Erfolg wird der zurückgegebene Session-Token gespeichert (kein Passwort mehr auf der Platte).
router.post("/account/signup", async (req, res) => {
    try{
        if(await func.checkInternetConnection() != 2){
            return res.json({ status: 0, data: { exists: false, data: "Um einen Account zu erstellen brauchst du eine Internetverbindung." } })
        }
        const signup = await func.send("/v1/auth/signup", { username: req.body.user, email: req.body.email, password: req.body.password, code: req.body.code, remember: true, sessionMetaData: launcherSessionMeta(false) })
        // /v1/auth/signup liefert { token, code }; userId wird aus dem Token abgeleitet.
        await revokePreviousLauncherSession(signup.token)
        session.saveSession({ token: signup.token })
        const id = session.getUserId()
        if(id) await adoptAccountOwnership(signup.token, id)
        // GET /v1/account liefert das eigene Profil (Id aus dem Token) — ohne Passwort, ohne 2FA-Secret.
        const account = await func.get("/v1/account", { token: signup.token }).catch(() => null)
        res.json({ status: 1, data: { exists: false, data: account || {} } })
    }
    catch(err){
        if(err instanceof func.ApiError){
            // 409 = existiert bereits (ALREADY_EXISTS), 403 = Code falsch/E-Mail nicht verifiziert.
            if(err.status === 409) return res.json({ status: 1, data: { exists: true, data: "Ein Nutzer mit diesen Daten existiert bereits. Ändere den Benutzernamen oder die E-Mail und probiers nochmal." } })
            return res.json({ status: 0, data: { exists: false, data: err.message } })
        }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Login gegen die v1-API (mehrstufig). Schritt 1: check-password. Ohne 2FA folgt direkt
// login/email (Skip-Token) → Session-Token wird gespeichert. Mit 2FA antworten wir mit
// { twoFactorRequired, challengeToken } — der Renderer fragt den TOTP-Code ab und ruft
// /account/login/2fa. Das Passwort wird NIE mehr gespeichert (nur der Session-Token).
// Beschreibt den Launcher als Session-Gerät, damit die API Name/Gerät/OS speichert (sonst „unknown").
// Standort leitet die API weiterhin best-effort aus der Request-IP ab (serverseitig).
function launcherSessionMeta(twoFactor){
    const platMap = { darwin: "macOS", win32: "Windows", linux: "Linux" }
    return {
        device: { type: "Desktop", os: platMap[process.platform] || process.platform, browser: "Sketchy Games Launcher" },
        platform: "Launcher",
        security: { login_method: "password", twoFactor: !!twoFactor },
    }
}
// Vor dem Speichern einer NEUEN Session die zuvor gespeicherte Launcher-Session (falls vorhanden)
// serverseitig widerrufen — sie ist nach dem Neu-Anmelden ohnehin ungenutzt und würde sonst als
// „tote", nicht mehr zuordenbare Sitzung in der Sitzungsliste stehen bleiben. Best effort (dasselbe
// /v1/auth/logout wie in /account/logout).
async function revokePreviousLauncherSession(newToken){
    const oldToken = session.getToken()
    if(oldToken && oldToken !== newToken){
        await func.send("/v1/auth/logout", {}, { token: oldToken }).catch(() => {})
    }
}
async function finishLogin(res, tokenPayload){
    // tokenPayload: { token, code, data } aus /v1/auth/login/email
    const account = tokenPayload.data
    await revokePreviousLauncherSession(tokenPayload.token)
    session.saveSession({ token: tokenPayload.token, userId: account.id })
    await adoptAccountOwnership(tokenPayload.token, account.id)
    return res.json({ status: 1, data: { correct: true, data: account } })
}
/**
 * Nach jedem Login: die Lizenzen des Kontos spiegeln (Bibliothek/Spielstart filtern rein lokal
 * danach) und bei einem KONTOWECHSEL die maschinenglobalen Update-Reste des Vorgängers wegräumen —
 * sonst stünde in der Glocke „Update verfügbar" für ein Spiel, das dem neuen Konto gar nicht gehört.
 * Bewusst awaited (der Login ist ohnehin online) und bewusst fehlertolerant: schlägt es fehl, bleibt
 * der Besitz „unbekannt" und es wird nicht gefiltert.
 */
async function adoptAccountOwnership(token, userId){
    try{
        const { switched } = ownership.noteLogin(userId)
        if(switched){
            let stale = []
            try{ stale = JSON.parse(await func.read(config.updatesFile)).updates || [] }catch{ stale = [] }
            for(const u of stale) await notificationStore.removeByKey("update:" + u.id, { force: true }).catch(() => {})
            await func.write(config.updatesFile, JSON.stringify({ updates: [] }, null, 3)).catch(() => {})
        }
        await ownership.sync(token, userId)
    }
    catch(err){ console.error("adoptAccountOwnership:", err) }
}
// Session aus einem reinen Token finalisieren (OAuth liefert nur den Token) — alte Launcher-Session
// widerrufen, speichern, Profil nachladen. Gibt das Konto-Objekt (oder {}) zurück.
async function finalizeSession(token){
    await revokePreviousLauncherSession(token)
    session.saveSession({ token })
    const id = session.getUserId()
    if(id) await adoptAccountOwnership(token, id)
    const account = await func.get("/v1/account", { token }).catch(() => null)
    return account || {}
}
// Social-Login (GitHub/Google/Discord) über den Systembrowser (RFC-8252-Loopback, siehe oauthLoopback.js).
router.post("/account/oauth", async (req, res) => {
    const provider = String(req.body && req.body.provider || "")
    try{
        if(!oauthLoopback.PROVIDERS.includes(provider)){
            return res.json({ status: 0, code: "unknown_provider", data: oauthErrors.messageFor("unknown_provider", provider) })
        }
        const status = await func.checkInternetConnection()
        if(status != 2){
            return res.json({ status: 0, code: "offline", data: status == 1 ? "Keine Verbindung zum Server. Bitte versuch es später erneut." : "Um dich anzumelden brauchst du eine Internetverbindung." })
        }
        const token = await oauthLoopback.startOAuth(provider, launcherSessionMeta(false))
        const account = await finalizeSession(token)
        res.json({ status: 1, data: { correct: true, data: account } })
    }
    catch(err){
        // err.message trägt den technischen Grund (Log), err.oauthCode die Ursache für die Meldung.
        console.error(req.path, provider, err)
        const code = (err && err.oauthCode) || "oauth_failed"
        res.json({ status: 0, code, data: oauthErrors.messageFor(code, provider) })
    }
})
// Bricht einen laufenden Social-Login ab (z.B. „Abbrechen"-Button), damit der offene
// /account/oauth-Request sofort rejectet, statt bis zum Timeout zu warten.
router.post("/account/oauth/cancel", (req, res) => {
    oauthLoopback.cancel()
    res.json({ status: 1, data: "abgebrochen" })
})
router.post("/account/login", async (req, res) => {
    try{
        const status = await func.checkInternetConnection()
        if(status != 2){
            return res.json({ status: 0, data: { correct: false, data: status == 1 ? "Keine Verbindung zum Server. Bitte versuche es später erneut." : "Um dich einzuloggen brauchst du eine Internetverbindung." } })
        }
        // Klartext-Passwort über HTTPS (kein client-seitiges AES mehr). Der Launcher-Schlüssel
        // (X-Launcher-Key) hängt func.send automatisch an → Bot-Check-Ausnahme.
        const check = await func.send("/v1/auth/check-password", { usernameOrEmail: req.body.userOrEmail, password: req.body.password })
        if(!check || !check.correct){
            return res.json({ status: 1, data: { correct: false, data: "Deine Anmeldedaten sind falsch. Überprüfe sie und probiers nochmal." } })
        }
        if(check.skip2FA){
            const login = await func.send("/v1/auth/login/email", { singleUse2FASkipToken: check.singleUse2FASkipToken, remember: true, sessionMetaData: launcherSessionMeta(false) })
            return finishLogin(res, login)
        }
        // 2FA nötig: Challenge-Token an den Renderer geben (TOTP-Abfrage), Login folgt in /account/login/2fa.
        return res.json({ status: 1, data: { correct: true, twoFactorRequired: true, challengeToken: check.singleUse2FAChallengeToken } })
    }
    catch(err){
        if(credentialLeakResponse(res, err)) return
        if(err instanceof func.ApiError){
            if(err.status === 429) return res.json({ status: 0, data: { correct: false, data: "Zu viele Fehlversuche. Bitte warte einen Moment.", retryAfter: err.retryAfter } })
            return res.json({ status: 1, data: { correct: false, data: err.message } })
        }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Schritt 2 bei aktivem 2FA: TOTP-Code + Challenge-Token → 2fa/verify → login/email.
router.post("/account/login/2fa", async (req, res) => {
    try{
        const verified = await func.send("/v1/auth/2fa/verify", { challengeToken: req.body.challengeToken, token: req.body.code })
        const login = await func.send("/v1/auth/login/email", { singleUse2FAToken: verified.singleUse2FAToken, remember: true, sessionMetaData: launcherSessionMeta(true) })
        return finishLogin(res, login)
    }
    catch(err){
        if(credentialLeakResponse(res, err)) return
        if(err instanceof func.ApiError) return res.json({ status: 1, data: { correct: false, data: err.message } })
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
/**
 * Geleakte Zugangsdaten: Die API verweigert die Sitzung (403) und legt die Angaben für den
 * Wiederherstellungsweg in die Fehler-Details. Der Renderer bekommt sie als eigener Fall
 * durchgereicht, damit er den Sperrbildschirm zeigen kann statt „Anmeldung fehlgeschlagen".
 * @returns {boolean} true, wenn bereits geantwortet wurde
 */
function credentialLeakResponse(res, err){
    const details = err instanceof func.ApiError ? err.details : null
    if(!details || details.code !== "CREDENTIAL_LEAK") return false
    res.json({
        status: 1,
        data: {
            correct: false,
            credentialLeak: true,
            recoveryToken: details.recoveryToken,
            verification: details.verification,
            email: details.email,
            detectedAt: details.detectedAt,
            data: details.data || "Deine Zugangsdaten tauchen in einem bekannten Datenleck auf.",
        },
    })
    return true
}
// Wiederherstellung nach geleakten Zugangsdaten: E-Mail-Code anfordern (nur ohne Authenticator-App).
router.post("/account/credential-alert/send-code", async (req, res) => {
    try{
        const data = await func.send("/v1/auth/credential-alert/send-code", { recoveryToken: req.body.recoveryToken })
        res.json({ status: 1, data })
    }
    catch(err){
        if(err instanceof func.ApiError) return res.json({ status: 0, data: err.message })
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Zweiten Faktor prüfen + neues Passwort setzen. Bei Erfolg liefert die API dieselbe Antwort wie
// ein normaler Login — die Sitzung wird also hier gespeichert und der Nutzer ist drin.
router.post("/account/credential-alert/resolve", async (req, res) => {
    try{
        const login = await func.send("/v1/auth/credential-alert/resolve", {
            recoveryToken: req.body.recoveryToken,
            code: req.body.code,
            newPassword: req.body.newPassword,
            remember: true,
            sessionMetaData: launcherSessionMeta(true),
        })
        return finishLogin(res, login)
    }
    catch(err){
        if(err instanceof func.ApiError) return res.json({ status: 0, data: err.message })
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
// Zustand für das Warnband einer bereits angemeldeten Sitzung.
router.get("/account/credential-alert", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 1, data: { open: false } })
        const data = await func.get("/v1/auth/credential-alert", { token })
        res.json({ status: 1, data })
    }
    catch(err){
        // Offline oder Serverfehler: kein Banner, aber auch kein Fehler in der Oberfläche.
        res.json({ status: 1, data: { open: false } })
    }
})
// Einheitliche Fehlerbehandlung für die authentifizierten Konto-/Sicherheits-Proxies.
function authProxyError(req, res, err){
    if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
    if(err instanceof func.ApiError) return res.json({ status: 0, data: err.message || err.toString() })
    console.error(req.path, err)
    res.json({ status: 0, data: err.toString() })
}
// --- Neuigkeiten (Startseite) ---
// Reicht den personalisierten Feed der API durch (/v1/feed: Updates + Beiträge zu Spielen in
// Besitz, globale Ankündigungen, Launcher-Versionshinweise).
//
// Eine Sache kann nur der Launcher wissen: OB die gerade laufende Version frisch installiert ist.
// Dafür merkt sich `lastSeenLauncherVersion` in den Einstellungen, welche Version zuletzt gesehen
// wurde; weicht sie ab, wird der passende `launcher`-Eintrag mit `fresh: true` markiert. Der
// Merker wird erst nachgezogen, wenn der Eintrag auch wirklich dabei war — sonst ginge der Hinweis
// verloren, falls die Notes zur neuen Version noch nicht veröffentlicht sind.
router.get("/news", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const params = new URLSearchParams()
        if(req.query.limit) params.set("limit", String(req.query.limit))
        if(req.query.before) params.set("before", String(req.query.before))
        const query = params.toString()
        const items = await func.get("/v1/feed" + (query ? "?" + query : ""), { token })
        const list = Array.isArray(items) ? items : []

        const current = require("../package.json").version
        let settings = null
        try{ settings = JSON.parse(func.decrypt(await func.read(config.settingsFile))) }
        catch(err){ console.warn("news: settings unlesbar, keine Frisch-Markierung:", err.message) }
        if(settings && settings.lastSeenLauncherVersion !== current){
            const fresh = list.find(n => n.kind === "launcher" && n.version === current)
            if(fresh){
                fresh.fresh = true
                settings.lastSeenLauncherVersion = current
                await func.write(config.settingsFile, func.encrypt(JSON.stringify(config.sanitizeSettings(settings), null, 3)))
            }
        }
        res.json({ status: 1, data: list })
    }
    catch(err){ authProxyError(req, res, err) }
})
// Versionshinweise einer Version (Ziel der Update-/Launcher-Karten im Feed).
router.get("/release-notes", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const params = new URLSearchParams()
        for(const key of ["target", "targetId", "version", "limit"]){
            if(req.query[key]) params.set(key, String(req.query[key]))
        }
        const data = await func.get("/v1/release-notes?" + params.toString(), { token })
        res.json({ status: 1, data })
    }
    catch(err){ authProxyError(req, res, err) }
})
// --- Passwort ändern (Settings › Sicherheit) — aktuelles + neues Passwort, serverseitig bcrypt-gehasht. ---
router.post("/account/change-password", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.send("/v1/auth/account/change-password", { currentPassword: req.body.currentPassword, newPassword: req.body.newPassword }, { token })
        res.json({ status: 1, data })
    }
    catch(err){ authProxyError(req, res, err) }
})
// --- 2FA-Verwaltung (TOTP): Secret/QR erzeugen, aktivieren (→ Backup-Codes), deaktivieren. ---
router.get("/2fa/generate", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.get("/v1/auth/2fa/generate", { token })
        res.json({ status: 1, data })
    }
    catch(err){ authProxyError(req, res, err) }
})
router.post("/2fa/enable", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.send("/v1/auth/2fa/enable", { token: req.body.code }, { token })
        res.json({ status: 1, data })
    }
    catch(err){ authProxyError(req, res, err) }
})
router.post("/2fa/disable", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.send("/v1/auth/2fa/disable", { token: req.body.code }, { token })
        res.json({ status: 1, data })
    }
    catch(err){ authProxyError(req, res, err) }
})
// --- Sitzungen: Status (inkl. 2FA-Flag), Liste, einzeln/alle-anderen abmelden. ---
router.get("/account/security", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.send("/v1/auth/session/get", {}, { token })
        res.json({ status: 1, data })
    }
    catch(err){ authProxyError(req, res, err) }
})
router.get("/account/sessions", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const data = await func.send("/v1/auth/session/getAll", {}, { token })
        res.json({ status: 1, data })
    }
    catch(err){ authProxyError(req, res, err) }
})
router.post("/account/sessions/invalidate", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        const sessionId = req.body.sessionId
        const data = await func.send("/v1/auth/session/invalidate", { sessionId }, { token })
        // Beendet der Nutzer die Sitzung, mit der er GERADE angemeldet ist, ist der lokale Token
        // ab sofort tot. Ohne das hier bliebe eine funktionslose Oberfläche stehen, bis irgendein
        // Aufruf zufällig einen 401 kassiert (Bibliothek/Spielstart sind token-frei).
        const selfRevoked = !!sessionId && session.decodeToken(token)?.sessionId === sessionId
        if(selfRevoked) session.clearSession()
        res.json({ status: 1, data, selfRevoked })
    }
    catch(err){ authProxyError(req, res, err) }
})
router.post("/account/sessions/invalidateAll", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        // NUR die ANDEREN Sitzungen beenden — die aktuelle (mit der der Nutzer gerade angemeldet
        // ist) bleibt gültig. Ein direktes /v1/auth/session/invalidateAll würde auch den eigenen
        // Token widerrufen → 401-Fehler in-app und alle Sitzungen verschwinden, obwohl der Nutzer
        // noch angemeldet ist. Deshalb aktuelle sessionId ermitteln und jede andere einzeln beenden.
        const current = await func.send("/v1/auth/session/get", {}, { token }).catch(() => null)
        const currentId = current?.sessionId || null
        const all = await func.send("/v1/auth/session/getAll", {}, { token })
        const others = (Array.isArray(all) ? all : []).filter(s => s?.sessionId && s.sessionId !== currentId)
        await Promise.all(others.map(s => func.send("/v1/auth/session/invalidate", { sessionId: s.sessionId }, { token }).catch(() => {})))
        res.json({ status: 1, data: { invalidated: others.length } })
    }
    catch(err){ authProxyError(req, res, err) }
})
// Leichter, rein lokaler Session-Status (kein Netzwerk) — für den Renderer-Auth-Guard, damit
// geschützte Seiten bei ungültiger/abgelaufener Session sofort zum Login umleiten können.
router.get("/session/status", (req, res) => {
    res.json({ status: 1, data: { loggedIn: session.isLoggedIn(), valid: session.isSessionValid() } })
})
router.get("/account", async (req, res) => {
    try{
        const token = session.getToken()
        const id = session.getUserId()
        if(!token || !id){
            return res.json({ status: 0, data: "Nicht angemeldet." })
        }
        if(await func.checkInternetConnection() == 2){
            // Kontodaten frisch von der API (mit Bearer). GET /v1/account liefert das eigene Profil
            // (Id aus dem Token) ohne Passwort, 2FA-Secret oder OAuth-Tokens.
            const response = await func.get("/v1/account", { token })
            return res.json({ status: 1, data: response })
        }
        // Offline: es gibt keine lokal gespeicherten Profildaten mehr (nur den Token). Minimalobjekt.
        return res.json({ status: 1, data: { id } })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){
            session.clearSession()
            return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen. Bitte melde dich neu an." })
        }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
router.post("/notify", async (req, res) => {
    try{
        func.sendNotification(req.body.title, req.body.message)
        res.json({
            status: 1,
            data: "Benachrichtigung gesendet."
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.post("/messageBox", async (req, res) => {
    try{
        const response = await func.showMessageBox(req.body.title, req.body.message, req.body.buttons, req.body.type)
        res.json({
            status: 1,
            data: response
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.get("/connection", async (req, res) => {
    try{
        const status = await func.checkInternetConnection()
        res.json({
            status: 1,
            data: status
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
// Mindestlaufzeit der Start-Animation, bevor sich das Fenster laut `actionAfterGameStarted`
// versteckt oder minimiert. Ohne sie wäre das Overlay (components/LaunchOverlay.jsx, ~0,45 s
// Aufziehen) weg, bevor man es gesehen hat. Das SPIEL startet davon unberührt sofort — verzögert
// wird ausschließlich das Verschwinden des Launchers.
const LAUNCH_ANIMATION_MS = 1000

router.post("/games/start", async (req, res) => {
    // ≈ Klickzeitpunkt: der Renderer öffnet das Overlay und schickt die Anfrage im selben Zug.
    const requestedAt = Date.now()
    try{
        // Resolve the product from the trusted registry — never run an arbitrary
        // path from the request body (would be remote-code-execution otherwise).
        const { product, notOwned } = await resolveRegisteredProduct({ name: req.body.name, filepath: req.body.filepath })
        if(notOwned){
            console.warn(req.path, "refused to start a game the current account has no license for:", req.body.name)
            return res.json({ status: 0, data: "Dieses Spiel gehört nicht zu deinem Konto. Hol es dir im Store, um es zu spielen." })
        }
        if(!product){
            console.error(req.path, "ERROR: no registered product matched the request")
            return res.json({ status: 0, data: "Das Programm zum starten konnte nicht gefunden werden." })
        }
        const filepath = product.start
        // The executable must live inside the product's own installation directory.
        if(!isPathInside(filepath, product.installationPath)){
            console.error(req.path, "ERROR: refused to start path outside installation directory", filepath)
            return res.json({ status: 0, data: "Der Startpfad ist ungültig." })
        }
        if(func.exists(filepath)){
            const program = func.launchProgram(filepath)
            program.on("spawn", async function(){
                playSessions.set(product.name, Date.now()) // Startzeit für Playtime-Tracking
                const installs = JSON.parse(await func.read(config.installsFile))
                for (let i = 0; i < installs.games.length; i++) {
                    const element = installs.games[i];
                    if(element.name == product.name){
                        if(installs.other.length > 0){
                            installs.other[0] = element
                        }
                        else{
                            installs.other.push(element)
                        }
                        break
                    }
                }
                await func.write(config.installsFile, JSON.stringify(installs, null, 3))

                const settings = JSON.parse(func.decrypt(await func.read(config.settingsFile)))
                // 0 = In den Hintergrund (Tray, läuft weiter), 1 = Minimieren, 2 = Offen lassen.
                // Erst verstecken, wenn die Start-Animation lange genug zu sehen war; die Registry-
                // Schreiberei oben hat davon meist schon einen Teil verbraucht.
                const hide = settings.actionAfterGameStarted == 0 ? func.hideToBackground
                    : settings.actionAfterGameStarted == 1 ? func.minimize
                    : null
                if(hide){
                    const wait = Math.max(0, LAUNCH_ANIMATION_MS - (Date.now() - requestedAt))
                    setTimeout(() => {
                        // Innerhalb der Wartezeit abgestürzt/sofort beendet? Dann nicht verstecken —
                        // der close-Handler unten räumt playSessions ab.
                        if(!playSessions.has(product.name)) return
                        try{ hide() }
                        catch(err){ console.error(req.path, "hide after game start failed:", err) }
                    }, wait)
                }
            })
            program.on("error", function(err){
                console.error(req.path, "ERROR:", err)
            })
            program.on("close", async function(code){
                console.log(req.path, "closed program with code", code)
                try{
                    const startedAt = playSessions.get(product.name)
                    playSessions.delete(product.name)
                    if(startedAt){
                        const elapsedSec = Math.min(Math.floor((Date.now() - startedAt) / 1000), 6 * 60 * 60) // Deckel: 6h/Sitzung
                        if(elapsedSec > 0) await addPlaytime(product.name, elapsedSec)
                    }
                }
                catch(err){ console.error(req.path, "playtime accumulate failed:", err) }
            })
            
            console.log(req.path, "started", filepath)
            res.json({
                status: 1,
                data: "Starte " + path.basename(filepath) + "."
            })
        }
        else{
            res.json({
                status: 0,
                data: "Das Programm zum starten konnte nicht gefunden werden."
            })
            console.error(req.path, "ERROR: game to start not found")
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})

router.post("/games/open", async (req, res) => {
    try{
        // Only ever open a folder belonging to a registered product, and open it
        // through Electron's shell (no command string -> no shell injection).
        const { product, notOwned } = await resolveRegisteredProduct({ name: req.body.name, filepath: req.body.filepath })
        if(notOwned){
            return res.json({ status: 0, data: "Dieses Spiel gehört nicht zu deinem Konto." })
        }
        if(!product){
            console.error(req.path, "ERROR: no registered product matched the request")
            return res.json({ status: 0, data: "Das Verzeichnis konnte nicht gefunden werden." })
        }
        const folder = path.dirname(product.start)
        if(!isPathInside(folder, product.installationPath) && path.resolve(folder) !== path.resolve(product.installationPath)){
            console.error(req.path, "ERROR: refused to open path outside installation directory", folder)
            return res.json({ status: 0, data: "Das Verzeichnis ist ungültig." })
        }
        if(func.exists(folder)){
            const errorMessage = await shell.openPath(folder)
            if(errorMessage){
                console.error(req.path, "ERROR:", errorMessage)
                return res.json({ status: 0, data: errorMessage })
            }
            console.log(req.path, "opened folder at", folder)
            res.json({
                status: 1,
                data: "Öffne Ordner bei " + folder + "."
            })
        }
        else{
            res.json({
                status: 0,
                data: "Das Verzeichnis konnte nicht gefunden werden."
            })
            console.error(req.path, "ERROR: directory to open not found")
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})

router.post("/games/delete", async (req, res) => {
    try{
        // Resolve from the trusted registry; the directory we remove must be the
        // product's own folder inside its installation path — never an arbitrary
        // path from the request (would allow deleting any directory otherwise).
        // Bewusst OHNE Lizenzprüfung: fremde Installationen müssen löschbar bleiben — genau dafür
        // gibt es die Aufräumliste „Fremde Installationen" in den Einstellungen.
        const resolved = await resolveRegisteredProduct({ name: req.body.name, filepath: req.body.filepath, requireOwned: false })
        if(!resolved.product){
            console.error(req.path, "ERROR: no registered product matched the request")
            return res.json({ status: 0, data: "Das zu entfernende Programm konnte nicht gefunden werden." })
        }
        const folder = path.dirname(resolved.product.start)
        if(!isPathInside(folder, resolved.product.installationPath)){
            console.error(req.path, "ERROR: refused to delete path outside installation directory", folder)
            return res.json({ status: 0, data: "Der zu entfernende Pfad ist ungültig." })
        }
        const name = resolved.product.name
        if(func.exists(folder)){
            await func.remove(folder)
            const installs = JSON.parse(await func.read(config.installsFile))
            for (let i = 0; i < installs.games.length; i++) {
                const element = installs.games[i]
                if(element.name == name){
                    installs.games.splice(i, 1)
                    break
                }
            }
            if(installs.other[0] && installs.other[0].name == name){
                installs.other.splice(0, 1)
            }
            await func.write(config.installsFile, JSON.stringify(installs, null, 3))
            res.json({
                status: 1,
                data: "Entferne " + name + "."
            })
            console.log(req.path, "deleted", folder)
        }
        else{
            res.json({
                status: 0,
                data: "Das zu entfernende Programm konnte nicht gefunden werden."
            })
            console.error(req.path, "ERROR: game to delete not found")
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
// Der frühere /email-Endpunkt (reichte req.body ungeprüft an /v1/email/send weiter) ist entfernt:
// er hatte keinen Aufrufer im Launcher, und /v1/email/send nimmt kein clientseitiges HTML mehr
// entgegen, sondern rendert serverseitige Vorlagen. Die Signup-Verifizierung läuft ohnehin über
// /account/verify (→ /v1/auth/verify, ohne Login).
let downloadProgress = 0
let downloadTime = {
    hours: 0,
    minutes: 0,
    seconds: 0,
}
let downloadSpeed = 0
let downloadSize = 0
let isDownloading = false
const downloadQueue = []
/** Resets the shared download progress/state back to idle. */
function resetDownloadState(){
    downloadProgress = 0
    downloadSpeed = 0
    downloadSize = 0
    downloadTime = { hours: 0, minutes: 0, seconds: 0 }
    isDownloading = false
}
router.post("/download", async (req, res) => {
    try{
        // Descriptor (neu): { id, name(=id), title, sha256 }. Der Installationspfad ist eine LOKALE
        // Entscheidung des Launchers (nicht vom Server). Der Client liefert KEINE Download-URL mehr —
        // download() holt sie pro Spiel lizenzgeprüft + kurzlebig signiert von der API
        // (/v1/store/:id/download-url).
        const d = req.body || {}
        const gameId = d.id || d.gameId
        if(!isNonEmptyString(gameId)){
            console.error(req.path, "rejected invalid download descriptor")
            return res.json({ status: 0, data: "Ungültiger Download." })
        }
        if(!isNonEmptyString(d.name)) d.name = gameId
        if(!isNonEmptyString(d.categorie)) d.categorie = "games"
        if(!isNonEmptyString(d.installationPath)){
            // Zielverzeichnis aus den Einstellungen, sonst der Default-Installationsordner.
            let installBase = config.installs
            try{ const s = JSON.parse(func.decrypt(await func.read(config.settingsFile))); if(isNonEmptyString(s.installationPath)) installBase = s.installationPath }catch(e){}
            d.installationPath = installBase.endsWith("/") ? installBase : installBase + "/"
            req.body.installationPath = d.installationPath
        }
        // --- Lizenz-Gate: Download nur für Spiele, die der Nutzer besitzt. Kostenlose Titel
        // werden hier automatisch beansprucht (claim).
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Bitte melde dich an, um Spiele herunterzuladen." })
        if(gameId){
            try{
                let owned = (await func.get("/v1/library/check/" + encodeURIComponent(gameId), { token }))?.owned
                if(!owned){
                    // Versuch, das Spiel zu beanspruchen (klappt nur, wenn es kostenlos ist).
                    await func.send("/v1/library/claim", { gameId }, { token }).catch((e) => { if(!(e instanceof func.ApiError)) throw e; else throw e })
                    owned = true
                }
                if(!owned) return res.json({ status: 0, data: "Du besitzt dieses Spiel nicht." })
            }
            catch(err){
                if(err instanceof func.ApiError){
                    if(err.status === 401){ session.clearSession(); return res.json({ status: 0, sessionExpired: true, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
                    if(err.code === "PAYMENT_REQUIRED" || err.status === 402) return res.json({ status: 0, data: "Dieses Spiel ist kostenpflichtig — Kauf wird noch nicht unterstützt." })
                    if(err.code === "ALREADY_OWNED") { /* schon in der Bibliothek → weiter */ }
                    else return res.json({ status: 0, data: err.message })
                }
                else throw err
            }
            // Besitz steht fest (geprüft oder gerade beansprucht) → lokalen Spiegel sofort
            // nachziehen, sonst filtert /installs das frisch installierte Spiel wieder heraus.
            ownership.markOwned(gameId)
        }
        // Bereits installiert? Dann NICHT erneut herunterladen — nur die Version prüfen. Der
        // Update-Weg läuft über denselben Endpunkt (die „Update verfügbar"-Benachrichtigung führt
        // auf die Produktseite), deshalb hebelt allein die ausdrückliche Absicht `allowUpdate`
        // (Knopf „Aktualisieren") diese Abkürzung aus.
        const { product: alreadyInstalled } = await resolveRegisteredProduct({ name: gameId, requireOwned: false })
        if(alreadyInstalled){
            // checkForUpdates() ist die einzige Update-Logik: Versionsvergleich gegen den
            // Build-Katalog, updatesFile schreiben und die „Update verfügbar"-Meldung erzeugen.
            const updates = await config.checkForUpdates().catch(() => [])
            const updateAvailable = updates.some(u => u.name === gameId)
            if(!(updateAvailable && d.allowUpdate)){
                console.log(req.path, "already installed, skipping download for", gameId)
                return res.json({
                    status: 1,
                    alreadyInstalled: true,
                    updateAvailable,
                    data: `„${alreadyInstalled.title || gameId}" ist bereits installiert.`
                })
            }
            console.log(req.path, "installed but outdated, updating", gameId)
        }
        const queue = engine.enqueue(d)
        console.log(req.path, "pushed to downloadQueue", queue)
        res.json({
            status: 1,
            data: queue
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
// --- Download-Endpunkte: dünne Delegates auf die Engine (src/downloadEngine.js) ---
// Antwort-Formen sind unverändert (Downloads.jsx verlässt sich auf data.{percentage,time,speed}
// bzw. data.paused). Die gesamte Pipeline (Delta/Range/Resume/Ganz-Zip) lebt in der Engine.
router.get("/download/cancel", async (req, res) => {
    try{
        const result = await engine.cancel()
        if(!result.ok) return res.json({ state: 0, data: result.message })
        res.json({
            state: 1,
            data: engine.getProgress()
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/download/state", (req, res) => {
    try{
        res.json({ state: 1, data: engine.getState() })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.get("/download/progress", (req, res) => {
    try{
        res.json({ state: 1, data: engine.getProgress() })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.get("/download/progress/reset", (req, res) => {
    try{
        engine.resetProgress()
        res.json({ status: 1, data: "reset download progress" })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.get("/downloads", (req, res) => {
    try{
        const downloadQueue = engine.getQueue()
        if(downloadQueue.length > 0){
            res.json({
                state: 1,
                data: {
                    downloadQueue,
                    progress: engine.getProgress().percentage
                }
            })
        }
        else{
            res.json({
                state: 1,
                data: "Momentan sind keine Downloads am laufen."
            })
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.get("/download/pause", (req, res) => {
    try{
        const result = engine.pause()
        res.json({ state: result.ok ? 1 : 0, data: result.message })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.get("/download/resume", (req, res) => {
    try{
        const result = engine.resume()
        res.json({ state: result.ok ? 1 : 0, data: result.message })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.post("/downloads/unqueue", (req, res) => {
    try{
        if(!isIndexInRange(req.body.index, engine.getQueue().length)){
            return res.json({ state: 0, data: "Ungültiger Index." })
        }
        res.json({ state: 1, data: engine.unqueue(req.body.index) })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.post("/downloads/move", (req, res) => {
    try{
        if(!isIndexInRange(req.body.index, engine.getQueue().length) || !isIndexInRange(req.body.to, engine.getQueue().length)){
            return res.json({ state: 0, data: "Ungültiger Index." })
        }
        res.json({ state: 1, data: engine.move(req.body.index, req.body.to) })
    }
    catch(err){
        console.error(req.path, err)
        res.json({ state: 0, data: err.toString() })
    }
})
router.get("/installs", async (req, res) => {
    try{
        const installs = JSON.parse(await func.read(config.installsFile))
        // Bibliothek = nur Spiele, für die das angemeldete Konto eine Lizenz hat. Die übrigen
        // Installationen bleiben auf der Platte und erscheinen als `foreign` in den Einstellungen
        // („Fremde Installationen" mit Löschen-Knopf). Ist der Besitz unbekannt, wird NICHT
        // gefiltert (ownership.js: lieber zu viel zeigen als den Besitzer aussperren).
        const { owned, foreign } = ownership.partitionForCurrentUser(installs.games)
        const lastPlayed = installs.other && installs.other[0]
        res.json({
            state: 1,
            data: {
                ...installs,
                games: owned,
                foreign,
                // „Zuletzt gespielt" eines fremden Kontos ebenfalls nicht durchreichen — der
                // Eintrag bleibt aber in der Datei, damit er beim Rückwechsel wieder da ist.
                other: lastPlayed && ownership.owns(lastPlayed.name) ? installs.other : [],
            }
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/library/img/:name", async (req, res) => {
    try{
        // Resolve the image path from the registry, not from the query string, so
        // the caller cannot read arbitrary files off the disk via this endpoint.
        // Ohne Lizenzprüfung: die Aufräumliste zeigt Cover fremder Installationen, und ein Bild
        // aus einem ohnehin vorhandenen Installationsordner ist kein Lizenzgut.
        const { product } = await resolveRegisteredProduct({ name: req.params.name, requireOwned: false })
        if(!product){
            console.error(req.path, "ERROR: no registered product matched", req.params.name)
            return res.status(404).json({ status: 0, data: "Bild nicht gefunden." })
        }
        // Cover-Dateiname stammt aus der Registry (downloadCoverImage setzt product.img,
        // z.B. "image.svg"); Fallback auf den alten Standardnamen "image.png".
        const imgName = (typeof product.img === "string" && /^image\.[a-z0-9]+$/.test(product.img)) ? product.img : config.imgFile
        const imgPath = path.join(product.installationPath, product.name, imgName)
        if(!isPathInside(imgPath, product.installationPath)){
            console.error(req.path, "ERROR: resolved image path escaped installation directory", imgPath)
            return res.status(400).json({ status: 0, data: "Ungültiger Bildpfad." })
        }
        res.sendFile(imgPath)
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})
router.get("/library/add", async (req, res) => {
    try{
        const filePath = (await func.showDialog(["openFile"]))[0]
        const folderPath = path.dirname(filePath)

        console.log(req.path, "filePath", filePath)

        const fileName = path.parse(filePath).name

        console.log(req.path, "fileName", fileName)

        // Neuer Katalog (GraphQL, { categories, games }): Spiele sind über `id` (Slug) bzw. `title`
        // identifiziert. Der frühere `softwares`-Zweig entfällt (das Datenmodell kennt ihn nicht mehr).
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Bitte melde dich an." })
        const storeRes = await storeAdapter.getStore(token)

        const match = storeRes.games.find(game => game.id == fileName || game.title == fileName)
        const isGame = !!match

        console.log(req.path, "isGame", isGame)

        if(!isGame){
            console.warn(req.path, "the file is not supported by the Sketchy Games Launcher")
            await func.showErrorBox("Not supported", "The file is not supported by the Sketchy Games Launcher")
            return res.json({ status: 0, data: "Das Produkt wurde im Store nicht gefunden." })
        }

        console.log(req.path, "product to add is a game", fileName)

        // Lizenz-Gate: ein Ordner von der Platte darf nicht am Besitz vorbei in die Bibliothek
        // wandern. Der Server entscheidet (der lokale Spiegel wäre manipulierbar).
        try{
            const owned = (await func.get("/v1/library/check/" + encodeURIComponent(match.id), { token }))?.owned
            if(!owned) return res.json({ status: 0, data: "Du besitzt dieses Spiel nicht." })
            ownership.markOwned(match.id)
        }
        catch(err){
            if(err instanceof func.ApiError) return res.json({ status: 0, data: "Der Besitz konnte nicht geprüft werden: " + err.message })
            throw err
        }

        const product = { ...match }
        // Der lokale Install-Registry nutzt `name` als Schlüssel — auf die Spiel-ID abbilden.
        product.name = match.id
        product.categorie = "games"
        product.size = await getDirectorySize(folderPath)
        product.installationPath = path.dirname(folderPath) + path.sep
        product.start = filePath
        // Nur informativ (Aufräumliste/Support) — über die Sichtbarkeit entscheidet die Lizenz.
        product.installedBy = session.getUserId()

        console.log(req.path, "end result of product", product)

        // write to installsFile
        const installs = JSON.parse(await func.read(config.installsFile))
        if(!installs.games.some(element => element.name == product.name)){
            installs.games.push(product)
            await func.write(config.installsFile, JSON.stringify(installs))
            console.log(req.path, "product added to installsFile and is tracked now in", config.installsFile)
        }
        else{
            console.error(req.path, "game is already tracked in the installsFile under games")
        }

        res.json({
            status: 1,
            data: product
        })

    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
module.exports = router