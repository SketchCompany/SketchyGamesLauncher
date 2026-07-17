const router = require("express").Router()
const bodyParser = require("body-parser")
const func = require("./functions")
const https = require("https")
const fs = require("fs")
const unzipper = require("unzipper")
// const nodemailer = require("nodemailer")
// const smtpTransport = require("nodemailer-smtp-transport")
const path = require("path")
const crypto = require("crypto")
const { shell } = require("electron")
const config = require("./launcherConfig")
const session = require("./session")
const storeAdapter = require("./storeAdapter")
const { apiUrl } = require("./apiBase")

router.use(bodyParser.json())

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
 * @returns {Promise<{product: object|null, categorie?: string, installs: object}>}
 */
async function resolveRegisteredProduct({ name, filepath } = {}){
    const installs = JSON.parse(await func.read(config.installsFile))
    const all = [
        ...installs.games.map(p => ({ p, c: "games" })),
        ...installs.softwares.map(p => ({ p, c: "softwares" })),
    ]
    let match
    if(name) match = all.find(x => x.p.name === name)
    if(!match && filepath) match = all.find(x => x.p.start && path.resolve(x.p.start) === path.resolve(filepath))
    if(!match) return { product: null, installs }
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
        const store = await storeAdapter.getStore(token)
        res.json({ status: 1, data: { ...store, platform: process.platform } })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
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
        let parsed
        try{ parsed = new URL(req.body.url) }
        catch(e){ parsed = null }
        if(!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")){
            console.error(req.path, "refused to open non-web url:", req.body.url)
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
        setTimeout(() => func.close(), 10)
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
        await moveCategory(installs.softwares, "softwares")

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
                data: "Keine Interneverbindung."
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

const notifications = []
router.get("/notifications", async (req, res) => {
    res.json({
        status: 1,
        data: notifications
    })
})
router.post("/notifications/add", async (req, res) => {
    // Persist only presentational fields; never store a callback/function string
    // (it used to be eval'd in the renderer -> remote-code-execution risk).
    const { title, message, type, action } = req.body || {}
    notifications.push({ title, message, type, ...(action ? { action } : {}) })
    res.json({
        status: 1,
        data: notifications
    })
})
router.get("/notifications/removeAll", async (req, res) => {
    notifications.splice(0, notifications.length)
    res.json({
        status: 1,
        data: notifications
    })
})
router.post("/notifications/remove", async (req, res) => {
    if(req.body.i != undefined){
        if(!isIndexInRange(req.body.i, notifications.length)){
            return res.json({ status: 0, data: "Ungültiger Index." })
        }
        notifications.splice(req.body.i, 1)
        res.json({
            status: 1,
            data: notifications
        })
    }
    else{
        for (let i = 0; i < notifications.length; i++) {
            const element = notifications[i];
            if(JSON.stringify(element) == JSON.stringify(req.body)){
                notifications.splice(i, 1)
                break
            }
        }
        res.json({
            status: 1,
            data: notifications
        })
    }
})
router.get("/lastplayed", async (req, res) => {
    try{
        const installs = JSON.parse(await func.read(config.installsFile))
        const lastPlayed = installs.other[0]
        res.json({
            status: 1,
            data: lastPlayed
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
        // Only persist a settings object whose shape matches the known schema.
        if(!req.body || typeof req.body !== "object" || !func.checkForIntegrity(req.body, config.settingsIntegrity)){
            console.error(req.path, "rejected settings with unexpected shape")
            return res.json({ status: 0, data: "Ungültige Einstellungen." })
        }
        await func.write(config.settingsFile, func.encrypt(JSON.stringify(req.body, null, 3)))
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
        // mehr über /u/update (das schriebe den Wert verbatim) — dafür gibt es change-password.
        const approved = await func.send("/v1/u/proof", { id, username: req.body.user, email: req.body.email }, { token })
        if(!approved){
            return res.json({ status: 0, data: "Ein Benutzer mit diesen Daten existiert bereits. Ändere sie und versuch es nochmal." })
        }
        await func.send("/v1/u/update", { id, username: req.body.user, email: req.body.email }, { token })
        res.json({ status: 1, data: "Änderungen gespeichert." })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){ session.clearSession(); return res.json({ status: 0, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
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
        const signup = await func.send("/v1/auth/signup", { username: req.body.user, email: req.body.email, password: req.body.password, code: req.body.code, remember: true })
        // /v1/auth/signup liefert { token, code }; userId wird aus dem Token abgeleitet.
        session.saveSession({ token: signup.token })
        const id = session.getUserId()
        const account = id ? await func.send("/v1/u/find", { id }, { token: signup.token }).catch(() => null) : null
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
async function finishLogin(res, tokenPayload){
    // tokenPayload: { token, code, data } aus /v1/auth/login/email
    const account = tokenPayload.data
    session.saveSession({ token: tokenPayload.token, userId: account.id })
    return res.json({ status: 1, data: { correct: true, data: account } })
}
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
            const login = await func.send("/v1/auth/login/email", { singleUse2FASkipToken: check.singleUse2FASkipToken, remember: true })
            return finishLogin(res, login)
        }
        // 2FA nötig: Challenge-Token an den Renderer geben (TOTP-Abfrage), Login folgt in /account/login/2fa.
        return res.json({ status: 1, data: { correct: true, twoFactorRequired: true, challengeToken: check.singleUse2FAChallengeToken } })
    }
    catch(err){
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
        const login = await func.send("/v1/auth/login/email", { singleUse2FAToken: verified.singleUse2FAToken, remember: true })
        return finishLogin(res, login)
    }
    catch(err){
        if(err instanceof func.ApiError) return res.json({ status: 1, data: { correct: false, data: err.message } })
        console.error(req.path, err)
        res.json({ status: 0, data: err.toString() })
    }
})
router.get("/account", async (req, res) => {
    try{
        const token = session.getToken()
        const id = session.getUserId()
        if(!token || !id){
            return res.json({ status: 0, data: "Nicht angemeldet." })
        }
        if(await func.checkInternetConnection() == 2){
            // Kontodaten frisch von der API (mit Bearer). /v1/u/find liefert das Profil ohne Passwort.
            const response = await func.send("/v1/u/find", { id }, { token })
            return res.json({ status: 1, data: response })
        }
        // Offline: es gibt keine lokal gespeicherten Profildaten mehr (nur den Token). Minimalobjekt.
        return res.json({ status: 1, data: { id } })
    }
    catch(err){
        if(err instanceof func.ApiError && err.status === 401){
            session.clearSession()
            return res.json({ status: 0, data: "Sitzung abgelaufen. Bitte melde dich neu an." })
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
router.post("/games/start", async (req, res) => {
    try{
        // Resolve the product from the trusted registry — never run an arbitrary
        // path from the request body (would be remote-code-execution otherwise).
        const { product } = await resolveRegisteredProduct({ name: req.body.name, filepath: req.body.filepath })
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
                for (let i = 0; i < installs.softwares.length; i++) {
                    const element = installs.softwares[i];
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
                if(settings.actionAfterGameStarted == 1){
                    func.minimize()
                }
                else if(settings.actionAfterGameStarted == 0){
                    func.close()
                }
            })
            program.on("error", function(err){
                console.error(req.path, "ERROR:", err)
            })
            program.on("close", function(code){
                console.log(req.path, "closed program with code", code)
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
        const { product } = await resolveRegisteredProduct({ name: req.body.name, filepath: req.body.filepath })
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
        const resolved = await resolveRegisteredProduct({ name: req.body.name, filepath: req.body.filepath })
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
            for (let i = 0; i < installs.softwares.length; i++) {
                const element = installs.softwares[i]
                if(element.name == name){
                    installs.softwares.splice(i, 1)
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
// Hinweis: die Signup-E-Mail-Verifizierung läuft jetzt über /account/verify (→ /v1/auth/verify,
// ohne Login). Dieser Endpunkt sendet transaktionale Mails und braucht daher eine Session.
router.post("/email", async (req, res) => {
    try{
        const token = session.getToken()
        if(!token) return res.json({ status: 0, data: "Nicht angemeldet." })
        if(await func.checkInternetConnection() == 2){
            const response = await func.send("/v1/email/send", req.body, { token })
            res.json({
                status: 1,
                data: response
            })
        }
        else{
            res.json({
                status: 0,
                data: "Keine Verbindung zu den Server oder zum Internet."
            })
        }
        
        // const toEmail = req.body.email
        // const subject = req.body.subject
        // const user = req.body.user
        // const message = req.body.message
        // let from = req.body.from
        // if(!from) from = "Sketch Company"
    
        // var transporter = nodemailer.createTransport(smtpTransport({
        //     service: 'gmail',
        //     host: 'smtp.gmail.com',
        //     auth: {
        //         user: 'sketchygames.sketchcompany@gmail.com',
        //         pass: 'tlzymeyehzncvdnj'
        //     }
        // }))

        // const htmlText = await func.get("https://api.sketch-company.de/emailTemplate")
        // const $ = cheerio.load(htmlText)
        // $("#user").append("Hey " + user + ",")
        // $("#message").append(message)
        // $("#c").append(new Date().getFullYear().toString())
        // const html = $.html()
        // console.log(req.path, "html:\n", html)
    
        // var mailOptions = {
        //     from: from + " <sketchygames.sketchcompany@gmail.com>",
        //     fromName: from,
        //     to: toEmail,
        //     subject,
        //     html
        // }
        
        // transporter.sendMail(mailOptions, function(error, info){
        //     if(error){
        //         console.error(error)
        //         res.json({
        //             state: 0,
        //             data: error.toString()
        //         })
        //     }
        //     else{
        //         console.log(req.path, "email sent: ", info.response)
        //         res.json({
        //             state: 1,
        //             data: {message: "email sent successfully", mailOptions, response: info.response}
        //         })
        //     }
        // })
    }
    catch(err){
        console.error(err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
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
                    if(err.status === 401){ session.clearSession(); return res.json({ status: 0, data: "Sitzung abgelaufen. Bitte melde dich neu an." }) }
                    if(err.code === "PAYMENT_REQUIRED" || err.status === 402) return res.json({ status: 0, data: "Dieses Spiel ist kostenpflichtig — Kauf wird noch nicht unterstützt." })
                    if(err.code === "ALREADY_OWNED") { /* schon in der Bibliothek → weiter */ }
                    else return res.json({ status: 0, data: err.message })
                }
                else throw err
            }
        }
        downloadQueue.push(req.body)
        console.log(req.path, "pushed to downloadQueue", downloadQueue)
        if(!isDownloading) download()
        setTimeout(res.json({
            status: 1,
            data: downloadQueue
        }), 100)
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
let currentDownloadResponse
let currentDownloadWriteStream
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

        if(downloadQueue.length > 0 && !isDownloading){
            isDownloading = true
            downloadProgress = 0
            downloadSpeed = 0
            downloadSize = 0
            downloadTime = {
                hours: 0,
                minutes: 0,
                seconds: 0,
            }
            const currentDownload = downloadQueue[0]
            console.log("download:", "started download for", currentDownload.name)
            // Signierte, kurzlebige Download-URL pro Spiel lizenzgeprüft von der API holen. Die
            // Auslieferung selbst (/builds/...) ist NUR signatur-gegated → KEIN Authorization-Header.
            let buildUrl
            try{
                const dlToken = session.getToken()
                const dl = await func.get("/v1/store/" + encodeURIComponent(currentDownload.id) + "/download-url", { token: dlToken })
                buildUrl = apiUrl(dl.url) // relativ ("/builds/..") → API_BASE + Pfad; absolut (eigene CDN-Subdomain) → unverändert
                if(!currentDownload.sha256 && dl.sha256) currentDownload.sha256 = dl.sha256
            }
            catch(err){
                console.error("download: could not obtain signed url", err && err.message)
                resetDownloadState()
                downloadQueue.splice(0, 1)
                const msg = (err && err.status === 401) ? "Sitzung abgelaufen. Bitte melde dich neu an."
                    : (err && (err.status === 403 || err.code === "NO_LICENSE")) ? "Du besitzt dieses Spiel nicht."
                    : (err && (err.status === 404 || err.code === "NO_BUILD")) ? "Für dieses Spiel ist noch kein Build verfügbar."
                    : "Die Download-URL konnte nicht erstellt werden."
                if(err && err.status === 401) session.clearSession()
                func.showErrorBox("Download fehlgeschlagen", msg).catch(()=>{})
                return
            }
            https.get(buildUrl, {sessionTimeout: 0, timeout: 0}, (response) => {
                // 401/403/404 → keine berechtigte Auslieferung; sauber abbrechen statt HTML/JSON als "zip" zu speichern.
                if(response.statusCode && response.statusCode >= 400){
                    console.error("download: server rejected build fetch, status", response.statusCode)
                    response.resume()
                    resetDownloadState()
                    downloadQueue.splice(0, 1)
                    func.showErrorBox("Download fehlgeschlagen", response.statusCode === 403 ? "Du besitzt dieses Spiel nicht (oder deine Sitzung ist abgelaufen)." : "Der Build konnte nicht geladen werden (Status " + response.statusCode + ").").catch(()=>{})
                    return
                }
                currentDownloadResponse = response
                const downloadPath = config.downloads + currentDownload.name + config.packageExt
                const writeStream = fs.createWriteStream(downloadPath)
                currentDownloadWriteStream = writeStream
                
                response.pipe(writeStream)

                const totalBytes = parseInt(response.headers["content-length"], 10)
                downloadSize = totalBytes
                let downloadedBytes = 0
                const startTime = Date.now()

                response.on("data", (chunk) => {
                    downloadedBytes += chunk.length

                    const elapsedTime = (Date.now() - startTime) / 1000 // in seconds
                    const speed = (downloadedBytes / elapsedTime) / (1024 * 1024) // in MB/s
                    const percentage =  Math.round((downloadedBytes / totalBytes) * 100)

                    const remainingBytes = totalBytes - downloadedBytes
                    const estimatedTimeLeft = Math.round(remainingBytes / (speed * 1024 * 1024))

                    let hours =  Math.floor(estimatedTimeLeft / 3600).toString()
                    let minutes = Math.floor(estimatedTimeLeft % 3600 / 60).toString()
                    let seconds = Math.floor(estimatedTimeLeft % 3600 % 60).toString()

                    if(parseInt(hours) < 10) hours = "0" + hours
                    if(parseInt(minutes) < 10) minutes = "0" + minutes
                    if(parseInt(seconds) < 10) seconds = "0" + seconds

                    downloadTime = {
                        hours,
                        minutes,
                        seconds,
                    }
                    downloadProgress = percentage - 1
                    downloadSpeed = speed.toFixed(2)
                    if(downloadProgress == -1) downloadProgress = 0
                    console.log("download:", currentDownload.name, "progress",  downloadProgress + "%")
                    console.log("download:", currentDownload.name, "speed", downloadSpeed + " MB/s")
                    console.log("download:", currentDownload.name, "time left", downloadTime.hours + ":" + downloadTime.minutes + ":" + downloadTime.seconds)
                })

                writeStream.on("finish", async() => {
                  try{
                    writeStream.close()
                    if(!currentDownloadResponse || !currentDownloadWriteStream) return
                    currentDownloadResponse = null
                    currentDownloadWriteStream = null
                    console.log("download:", "completed for", currentDownload.name)

                    // Verify package integrity before we unpack and (auto-)run it.
                    const expected = expectedChecksum(currentDownload)
                    if(expected){
                        const actual = await sha256File(downloadPath)
                        if(actual.toLowerCase() !== expected.toLowerCase()){
                            console.error("download: checksum mismatch for", currentDownload.name, "expected", expected, "got", actual)
                            await func.remove(downloadPath)
                            await func.showErrorBox("Download fehlgeschlagen", "Die Integritätsprüfung (SHA-256) für " + currentDownload.name + " ist fehlgeschlagen. Die Datei wurde aus Sicherheitsgründen verworfen.")
                            resetDownloadState()
                            downloadQueue.splice(0, 1)
                            if(downloadQueue.length > 0 && !isDownloading) download()
                            return
                        }
                        console.log("download: checksum verified for", currentDownload.name)
                    }
                    else console.warn("download: no checksum provided for", currentDownload.name, "- skipping integrity verification")

                    let createShortcut
                    if(currentDownload.createShortcut != undefined){
                        if(currentDownload.createShortcut) createShortcut = true
                        else createShortcut = false
                        delete currentDownload["createShortcut"]
                    }
                    else{
                        console.log("download: createShortcut field not found, creating shortcut")
                        createShortcut = true
                    }
                    const latestInfo = await unpackage(currentDownload, downloadPath, currentDownload.installationPath /* config.installs */ + currentDownload.name + "/")
                    await downloadImage(currentDownload)
                    if(createShortcut) func.createShortcut(latestInfo.name, latestInfo.start, latestInfo.start)
                    else console.log("createShortcut: shortcut was not created")
                    downloadProgress = 100
                    await addToAccount(latestInfo)
                    downloadQueue.splice(0, 1)
                    console.log("download:", "removed from downloadQueue", downloadQueue)
                    downloadTime = {
                        hours: 0,
                        minutes: 0,
                        seconds: 0
                    }
                    downloadSpeed = 0
                    downloadSize = 0
                    isDownloading = false

                    if(downloadQueue.length > 0 && !isDownloading){
                        download()
                    }
                  }
                  catch(err){
                    // Unpacking failed (e.g. zip-slip rejected) — discard the
                    // package, do not install or run anything, and continue queue.
                    console.error("download: failed while finishing", currentDownload && currentDownload.name, err)
                    try{ await func.remove(downloadPath) } catch(e){ /* best effort */ }
                    await func.showErrorBox("Download fehlgeschlagen", "Das Paket konnte nicht sicher entpackt werden und wurde verworfen.")
                    resetDownloadState()
                    downloadQueue.splice(0, 1)
                    if(downloadQueue.length > 0 && !isDownloading) download()
                  }
                })
            }).on("error", (err) => {
                console.error(err)
            })
        }
        else console.log("download:", "downloadQueue is empty")
    }
    catch(err){
        console.error("download:", err)
    }
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
/**
 * Extracts a zip into ```destination``` while rejecting any entry whose resolved
 * path would land outside of ```destination``` (zip-slip protection). Replaces
 * the previous blind ```directory.extract()``` call.
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
    }
}
async function unpackage(product, zipPath, destination){
    console.log("unpackage:", "started unpacking for", product.name)
    return new Promise(async (cb, reject) => {
      try{
        await safeExtract(zipPath, destination)
        product.size = await getDirectorySize(destination)
        product.start = destination + product.name + config.appExt
        console.log("unpackage:", "finished unpacking", product.name)
        let installs = JSON.parse(await func.read(config.installsFile))
        for (let i = 0; i < installs[product.categorie].length; i++) {
            const element = installs[product.categorie][i]
            if(element.name == product.name){
                installs[product.categorie].splice(i, 1)
                break
            }
        }
        installs[product.categorie].push(product)
        await func.write(config.installsFile, JSON.stringify(installs, null, 3))
        await func.remove(zipPath)
        cb(product)
      }
      catch(err){
        console.error("unpackage:", err)
        reject(err)
      }
    })
}
async function getDirectorySize(path){
    let size = 0
    const files = await func.readDir(path)
    for (let i = 0; i < files.length; i++) {
        const element = files[i];
        const filePath = path + "/" + element
        const stats = fs.statSync(filePath)
        if(stats.isFile()) size += stats.size
        else if(stats.isDirectory()) size += await getDirectorySize(filePath)
    }
    return size
}
async function downloadImage(product){
    console.log("downloadImage: started for", product.resourcesUrl + "1.png")
    return new Promise(cb => {
        https.get(product.resourcesUrl + "1.png", (response) => {
            const writeStream = fs.createWriteStream(product.installationPath + product.name + "/" + config.imgFile)
            response.pipe(writeStream)
            writeStream.on("finish", function(){
                writeStream.close()
                console.log("downloadImage: finished for", product.resourcesUrl + "1.png")
                cb()
            })
        })
    })
}
// Besitz wird NICHT mehr durch Anhängen an account.games abgebildet, sondern durch die Lizenz
// (beim Download beansprucht, siehe /download). Nach erfolgreichem Download wird hier nur noch der
// Download-Zähler der API bedient (POST /v1/store/:id/download; verlangt Session + Lizenz — beides
// liegt zu diesem Zeitpunkt vor). Fehler sind nicht kritisch (nur Statistik).
function addToAccount(product){
    return new Promise(async cb => {
        try{
            const token = session.getToken()
            const gameId = product && (product.id || product.gameId)
            if(token && gameId && await func.checkInternetConnection() == 2){
                await func.send("/v1/store/" + encodeURIComponent(gameId) + "/download", {}, { token }).catch((e) => console.warn("addToAccount: download count failed:", e.message))
            }
            cb()
        }
        catch(err){
            console.error("addToAccount:", err)
            cb(err)
        }
    })
}
router.get("/download/cancel", async (req, res) => {
    try{
        console.log("download:", "canceled")
        currentDownloadResponse.destroy()
        currentDownloadWriteStream.destroy()
        currentDownloadResponse = null
        currentDownloadWriteStream = null
        downloadProgress = 0
        downloadSize = 0
        downloadSpeed = 0
        downloadTime = {
            hours: 0,
            minutes: 0,
            seconds: 0
        }
        isDownloading = false
        const name = downloadQueue.splice(0, 1)[0].name
        console.log("download:", "removed from downloadQueue", downloadQueue)
        await func.remove(config.downloads + name + config.ext)
        if(downloadQueue.length > 0 && !isDownloading){
            download()
        }
        res.json({
            state: 1,
            data: {
                percentage: downloadProgress,
                time: downloadTime,
                speed: downloadSpeed
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
router.get("/download/state", (req, res) => {
    try{
        if(currentDownloadResponse && currentDownloadResponse.isPaused()) res.json({
            state: 1,
            data: true
        })
        else res.json({
            state: 1,
            data: false
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
let lastDownloadProgress = 0
router.get("/download/progress", (req, res) => {
    try{
        if(lastDownloadProgress == 99 && downloadProgress == 0){
            lastDownloadProgress = downloadProgress
            res.json({
                state: 1,
                data: {
                    percentage: 100,
                    time: downloadTime,
                    speed: downloadSpeed
                }
            })
        }
        else{
            lastDownloadProgress = downloadProgress
            res.json({
                state: 1,
                data: {
                    percentage: downloadProgress,
                    time: downloadTime,
                    speed: downloadSpeed
                }
            })
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/download/progress/reset", (req, res) => {
    try{
        downloadProgress = 0
        downloadSpeed = 0
        downloadSize = 0
        downloadTime = {
            hours: 0,
            minutes: 0,
            seconds: 0
        }
        res.json({
            status: 1,
            data: "reset download progress"
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
router.get("/downloads", (req, res) => {
    try{
        if(downloadQueue.length > 0){
            res.json({
                state: 1,
                data: {
                    downloadQueue,
                    progress: downloadProgress
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
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/download/pause", (req, res) => {
    try{
        if(!currentDownloadResponse.isPaused()){
            currentDownloadResponse.pause()
            res.json({
                state: 1,
                data: "Der Download wurde pausiert."
            })
        }
        else res.json({
            state: 0,
            data: "Der Download ist bereits pausiert."
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
router.get("/download/resume", (req, res) => {
    try{
        if(currentDownloadResponse.isPaused()){
            currentDownloadResponse.resume()
            res.json({
                state: 1,
                data: "Der Download wurde fortgesetzt."
            })
        }
        else res.json({
            state: 0,
            data: "Der Download ist nicht pausiert und kann nicht fortgesetzt werden."
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
router.post("/downloads/unqueue", (req, res) => {
    try{
        if(!isIndexInRange(req.body.index, downloadQueue.length)){
            return res.json({ state: 0, data: "Ungültiger Index." })
        }
        downloadQueue.splice(req.body.index, 1)
        res.json({
            state: 1,
            data: downloadQueue
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
router.post("/downloads/move", (req, res) => {
    try{
        if(!isIndexInRange(req.body.index, downloadQueue.length) || !isIndexInRange(req.body.to, downloadQueue.length)){
            return res.json({ state: 0, data: "Ungültiger Index." })
        }
        downloadQueue.splice(req.body.to, 0, downloadQueue.splice(req.body.index, 1)[0])
        res.json({
            state: 1,
            data: downloadQueue
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
router.get("/installs", async (req, res) => {
    try{
        const installs = JSON.parse(await func.read(config.installsFile))
        res.json({
            state: 1,
            data: installs
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
        const { product } = await resolveRegisteredProduct({ name: req.params.name })
        if(!product){
            console.error(req.path, "ERROR: no registered product matched", req.params.name)
            return res.status(404).json({ status: 0, data: "Bild nicht gefunden." })
        }
        const imgPath = path.join(product.installationPath, product.name, config.imgFile)
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

        let product = null

        if(isGame){
            console.log(req.path, "product to add is a game", fileName)

            product = { ...match }
            // Der lokale Install-Registry nutzt `name` als Schlüssel — auf die Spiel-ID abbilden.
            product.name = match.id
            product.categorie = "games"
            product.size = await getDirectorySize(folderPath)
            product.installationPath = path.dirname(folderPath) + path.sep
            product.start = filePath

            console.log(req.path, "end result of product", product)
        }
        else{
            console.warn(req.path, "the file is not supported by the Sketchy Games Launcher")
            await func.showErrorBox("Not supported", "The file is not supported by the Sketchy Games Launcher")
        }

        // write to installsFile
        const installs = JSON.parse(await func.read(config.installsFile))
        if(product.categorie == "games"){
            if(!installs.games.some(element => element.name == product.name)){
                installs.games.push(product)

                await func.write(config.installsFile, JSON.stringify(installs))
                console.log(req.path, "product added to installsFile and is tracked now in", config.installsFile)
            }
            else{
                console.error(req.path, "game is already tracked in the installsFile under games")
            }
        }
        else if(product.categorie == "softwares"){
            if(!installs.softwares.some(element => element.name == product.name)){
                installs.softwares.push(product)

                await func.write(config.installsFile, JSON.stringify(installs))
                console.log(req.path, "product added to installsFile and is tracked now in", config.installsFile)
            }
            else{
                console.error(req.path, "game is already tracked in the installsFile under softwares")
            }
        }
        

        res.json({
            status: 1,
            data: product
        })

        // const folderPath = (await func.showDialog())[0] + "/"

        // console.log(req.path, "folderPath:", folderPath)

        // const folderContent = await func.readDir(folderPath)

        // console.log(req.path, "folderContent:", folderContent)
        
        // // check if folder contains an executable file to symbolize a "game" or "program" there are always more files that are important
        // // to run the program but its a first simple check
        // if(folderContent.some(file => file.endsWith(".exe"))){
        //     const storeRes = await func.get("https://api.sketch-company.de/store")
        //     const exeFilesInFolder = folderContent.filter(file => file.endsWith(".exe"))
        //     exeFilesInFolder.splice(exeFilesInFolder.indexOf("UnityCrashHandler64.exe"), 1)

        //     console.log(req.path, "exeFilesInFolder:", exeFilesInFolder)

        //     let newProduct = null

        //     if(exeFilesInFolder.filter(file => storeRes.games.some(element => element.name == path.basename(folderPath + file)))){
        //         const file = folderPath + exeFilesInFolder.filter(file => storeRes.games.some(element => element.name == path.basename(folderPath + file)))[0]

        //         if(file){
        //             console.log(req.path, "file:", file)

        //             const productName = path.basename(file)

        //             console.log(req.path, "productName:", productName)

        //             newProduct = storeRes.games[productName]
        //             newProduct.categorie = "games"
        //             newProduct.size = await getDirectorySize(folderPath)
        //             newProduct.installationPath = folderPath
        //             newProduct.start = folderPath + "/" + productName + ".exe"
        //             newProduct.patchNotes = getPatchNotes(newProduct.patchNotes, 5)
        //         }
        //         else console.warn(req.path, "there is no game in this folder, that the Sketchy Games Launcher supports")                
        //     }
        //     else if(exeFilesInFolder.filter(file => storeRes.softwares.some(element => element.name == path.basename(folderPath + file)))){
        //         const file = folderPath + exeFilesInFolder.filter(file => storeRes.softwares.some(element => element.name == path.basename(folderPath + file)))[0]

        //         if(file){
        //             console.log(req.path, "file:", file)

        //             const productName = path.basename(file)

        //             console.log(req.path, "productName:", productName)

        //             newProduct = storeRes.softwares[productName]
        //             newProduct.categorie = "softwares"
        //             newProduct.size = await getDirectorySize(folderPath)
        //             newProduct.installationPath = folderPath
        //             newProduct.start = folderPath + "/" + productName + ".exe"
        //             newProduct.patchNotes = getPatchNotes(newProduct.patchNotes, 5)
        //         }
        //         else console.warn(req.path, "there is no software in this folder, that the Sketchy Games Launcher supports")                
        //     }
        //     else{
        //         const errorRes = await func.showErrorBox("Invalid product", "The product to add cannot be found in our available products. This game is not compatible with the Sketchy Games Launcher.")
        //     }

        //     console.log(req.path, "newProduct:", newProduct)
        //     res.json({
        //         status: 1,
        //         data: newProduct
        //     })
        // }
        // else{
        //     const errorRes = await func.showErrorBox("No executable was found", "There is no .exe file in this folder. You need to ad valid folder with an .exe file to be run as \"game\" or \"program\"")
        // }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
function getPatchNotes(notes, depth){
    let result = ""
    for (let i = 0; i < depth; i++) {
        const element = notes[i]
        if(!element) continue
        result += element.version
        result += "<br>"
        result += element.notes.replaceAll("\n", "<br>")
        result += "<br><br>"
    }
    return result
}
module.exports = router