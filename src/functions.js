const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const electron = require('electron')
const child_process = require('child_process')
const createDesktopShortcut = require('create-desktop-shortcuts')
const markdown = require("markdown").markdown;
const NodeCache = require( "node-cache" )
const sessionCache = new NodeCache({stdTTL: 10, checkperiod: 30})

function getRepository(){
    return new Promise(async cb => {
        try{
            const config = require("./launcherConfig")
            const { Octokit } = await import("@octokit/rest");

            // Patch notes only need published releases of a public repo, which the
            // GitHub API serves unauthenticated. No access token is shipped in the
            // app anymore; an optional GITHUB_TOKEN from the environment is used
            // solely to raise rate limits when available (never bundled).
            const octokit = new Octokit(process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {})
            
            const response = await octokit.rest.repos.listReleases({
                owner: 'SketchCompany',
                repo: 'SketchyGamesLauncher',
            })

            // dont log the response, because it contains data that should not be shown to the user
            //console.log("getRepository: data:", response.data)

            const rawReleases = response.data
            const filteredReleases = rawReleases.filter(release => !release.draft && !release.prerelease);
            const releases = []
            filteredReleases.forEach((release) => {
                releases.push({
                    name: release.name,
                    tag: release.tag_name,
                    description: markdown.toHTML(release.body)
                })
            })
            cb(releases)
        }
        catch(err){
            console.error("getRepository: error", err)
            cb(err)
        }
    })
}

/**
 * Erstellt eine Desktop-Verknüpfung für ein installiertes Spiel — plattformübergreifend über
 * `create-desktop-shortcuts` (Windows .lnk, Linux .desktop, macOS-Alias). Ersetzt den früheren
 * rohen PowerShell-Aufruf, der Name/Pfad UNESCAPED interpolierte (Injection) und in ein literales
 * `%userprofile%\Start Menu\...Startup`-Verzeichnis schrieb (Autostart statt Desktop + nicht
 * expandierter Pfad). Fehler sind nie fatal — eine Installation darf daran nie scheitern.
 * @param {string} name Anzeigename der Verknüpfung
 * @param {string} filePath Pfad zur Executable / zum .app-Bundle
 * @param {string} [icon] optionaler Icon-Pfad (Windows: .ico) — wird nur genutzt, wenn passend
 */
async function createShortcut(name, filePath, icon){
    try{
        const win = { filePath, name }
        if(typeof icon === "string" && icon.toLowerCase().endsWith(".ico")) win.icon = icon
        const ok = createDesktopShortcut({
            windows: win,
            linux: { filePath, name },
            osx: { filePath, name },
        })
        if(!ok) console.warn("createShortcut: creation reported failure for", name)
    }
    catch(err){
        console.error("createShortcut:", err)
    }
}
/**
 * Baut die Optionen für eine OS-Benachrichtigung. Icon: dasselbe ```img/app.png``` wie Fenster und
 * Tray (index.js) — vorher lagen hier abweichende Bilder (icon-scaled.png/icon.png).
 * Unter macOS wird ```icon``` bewusst WEGGELASSEN: das System zeigt dort ohnehin das App-Icon des
 * Bundles an, ein gesetztes ```icon``` erscheint ZUSÄTZLICH als zweites Bild in der Mitteilung.
 * Windows/Linux haben kein automatisches App-Icon, dort wird app.png gesetzt.
 * @param {string} title
 * @param {string} body
 */
function notificationOptions(title, body){
    const config = require("./launcherConfig")
    const options = { title: "Sketchy Games Launcher", subtitle: title, body }
    if(process.platform !== "darwin") options.icon = config.resources + "img/app.png"
    return options
}
/**
 * used to send a notification with a ```title``` and ```message```
 * @param {string} title the title of the notification
 * @param {string} message the message of the notification
 */
async function sendNotification(title, message){
    const config = require("./launcherConfig")
    try{
        const settings = JSON.parse(decrypt(await read(config.settingsFile)))
        if(settings.desktopNotifications) {
            new electron.Notification(notificationOptions(title, message))
            .addListener("click", function(e) {
                open()
            }).show()
        }
    }
    catch(err){
        console.error("sendNotification:", err)
        new electron.Notification(notificationOptions(title, message + " Error: " + err.toString()))
        .addListener("click", function(e) {
            open()
        }).show()
    }
}
/**
 * used to load an ```url``` into the current window. The ```url``` has to start with a ```/``` slash
 * @param {string} url the url to redirect (load) to. The ```url``` has to start with a ```/``` slash
 * @returns {Promise}
 */
function redirect(url){
    return new Promise(async cb => {
        const config = require("./launcherConfig")
        await electron.BrowserWindow.getAllWindows()[0].loadURL("http://localhost:" + config.PORT + url)
        cb()
    })
}
/**
 * used to move the window to the ```top``` and ```focus``` it
 */
function open(){
    const win = electron.BrowserWindow.getAllWindows()[0]
    if(!win) return
    win.setMovable(true)
    win.show()   // aus dem Tray/Hintergrund zurückholen
    win.focus()
    win.moveTop()
}
/**
 * Launcher ins Tray/den Hintergrund verstecken (NICHT beenden) + einmalige Systemnachricht.
 * Prozess + Express-Server + Playtime-Tracking laufen weiter (Steam-artiger Hintergrundbetrieb).
 */
function hideToBackground(){
    const win = electron.BrowserWindow.getAllWindows()[0]
    if(win) win.hide()
    sendNotification("Sketchy Games läuft weiter", "Der Launcher läuft im Hintergrund weiter. Beenden über das Tray-Symbol.")
}
/**
 * Launcher WIRKLICH beenden — nur für die Auto-Update-Übernahme (/close-for-update), wo eine
 * neue Instanz die alte ablöst. Setzt app.isQuitting, damit der close→hide-Handler nicht greift.
 */
function quitLauncher(){
    electron.app.isQuitting = true
    electron.app.quit()
}
/**
 * used to ```minimize``` the current focused window
 */
function minimize(){
    sendNotification("Minimized Window", "The launcher window got minimized.")
    electron.BrowserWindow.getAllWindows()[0].minimize()
}
/**
 * used to open a dialog window with a specific ```type``` to define what can be selected
 * @param {} properties defines what type of dialog should be opened
 * @returns {Promise} returns the selected objects, or an error if nothing was selected
 */
function showDialog(properties, filters){
    return new Promise(async cb => {
        if(!properties) properties = ["openDirectory", "createDirectory"]
        if(!filters && properties.some(element => element == "openFile")) filters = [{name: "Executable", extensions: ["exe"]}]
        const selected = await electron.dialog.showOpenDialog({properties, filters})
        if(!selected.canceled) cb(selected.filePaths)
        else cb([])
    })
}
/**
 * shows a small message box window
 * @param {string} title the title of the message box window
 * @param {string} message the message in the message box window
 * @param {Array<string>} buttons the buttons for the message box window to be clicked by the user as strings in an array
 * @param {string} type the type of the window, which the following options: ```none```, ```info```, ```error```, ```question``` or ```warning```
 * @returns {Promise<number>} the index of the clicked button in the message box window
 */
function showMessageBox(title, message, buttons, type){
    return new Promise(async cb => {
        const selected = await electron.dialog.showMessageBox({title, message, buttons, type, defaultId: 0})
        cb(selected.response) // the index of the clicked button
    })
}
/**
 * shows a small window as error with a custom ```title``` and ```message```
 * @param {string} title the title of the error box window
 * @param {string} message the message or error of the error box window
 * @returns 
 */
function showErrorBox(title, message){
    return new Promise(async cb => {
        electron.dialog.showErrorBox(title, message)
        cb()
    })
}
/**
 * checks if the file or directory exists at the goven ```path```
 * @param {string} path ```path``` to file or directory to check
 * @returns {boolean} returns true or false, wether the file or directory exists or not
 */
function exists(path){
    return fs.existsSync(path)
}
/**
 * copys a file at the given ```path```
 * @param {string} path ```path``` to file to copy
 * @param {string} dest ```path``` to new file
 * @returns {null} returns nothing
 */
function copy(path, dest){
    return fs.promises.copyFile(path, dest)
}
/**
 * removes a file or directory at the given ```path``` (recursively).
 * @param {string} path ```path``` to file or directory to remove
 * @returns {Promise<void>}
 */
function remove(path){
    return fs.promises.rm(path, { recursive: true, force: true })
}
/**
 * move a directory or file to the given ```dest```.
 * @param {string} path the directory or file to move
 * @param {string} dest the new location
 * @returns {Promise<void>}
 */
function move(path, dest){
    return fs.promises.rename(path, dest)
}
/**
 * reads a directory at the given ```path```.
 * @param {string} path the directory to read the files from
 * @returns {Promise<Array<string>>} every file in the given directory
 */
function readDir(path){
    return fs.promises.readdir(path)
}
/**
 * reads a file at the given ```path```.
 * @param {string} path the file to read
 * @returns {Promise<string>} the content of the file as a string
 */
async function read(path){
    const data = await fs.promises.readFile(path)
    return data.toString()
}
/**
 * writes ```data``` into a file at the given ```path```.
 * @param {string} path the path where the file should be created
 * @param {string} data the data to write
 * @returns {Promise<void>}
 */
function write(path, data){
    return fs.promises.writeFile(path, data)
}
/**
 * creates a directory at the given ```path```, including missing parents.
 *
 * `recursive` ist hier nicht Bequemlichkeit, sondern der Erstlauf-Fall: `setupPaths()` legt
 * `<globalDir>/installs/` an, aber `<globalDir>` selbst ("Sketchy Games Launcher") legt niemand an.
 * Auf einem frischen Rechner warf das erste mkDir deshalb ENOENT, `setupPaths` brach im catch ab —
 * und damit entstanden auch installs.data, settings.data und updates.data nie. Auf Rechnern, auf
 * denen der Ordner schon lag, war der Fehler unsichtbar.
 * @param {string} path the path to create the directory
 * @returns {Promise<void>}
 */
function mkDir(path){
    return fs.promises.mkdir(path, { recursive: true })
}

// NOTE: the helpers above now REJECT on failure (previously they resolved with
// the Error object). Every caller awaits inside a try/catch — make sure new call
// sites keep that contract.

const { apiUrl, apiHeaders } = require("./apiBase")

// Ein typisierter Fehler für abgelehnte API-Aufrufe, damit Aufrufer 401/429 gezielt behandeln
// können (Re-Login bei 401, Wartezeit bei 429). Trägt den HTTP-Status und den v1-error.code/message.
class ApiError extends Error {
    constructor(message, status, code, details){
        super(message || "API-Fehler")
        this.name = "ApiError"
        this.status = status
        this.code = code
        this.details = details
        this.retryAfter = details && details.retryAfter
    }
}

// Parst eine Response im v1-Envelope { success, data | error{code,message,details} } und wirft
// bei success:false bzw. HTTP-Fehler einen ApiError. Gibt sonst `data` zurück.
async function parseV1(response, url){
    let body = null
    try{ body = await response.json() }catch(e){ /* leerer/ungültiger Body */ }
    if(body && typeof body === "object" && typeof body.success === "boolean"){
        if(body.success) return body.data
        const err = body.error || {}
        throw new ApiError(err.message, response.status, err.code, err.details)
    }
    // Kein v1-Envelope (z.B. Root-Route /status) → Rohantwort bzw. Legacy-{status,data} durchreichen.
    if(!response.ok) throw new ApiError((body && (body.data || body.error)) || ("HTTP " + response.status), response.status)
    return body && body.data !== undefined ? body.data : body
}

/**
 * GET auf einen /v1-relativen (oder absoluten) Pfad. Hängt Bearer-Token (falls übergeben) und
 * den Launcher-Schlüssel an, parst das v1-Envelope. Wirft ApiError bei Ablehnung.
 * @param {string} path
 * @param {{ token?: string|null }} [opts]
 */
async function get(path, opts = {}){
    const url = apiUrl(path)
    const response = await fetch(url, { headers: apiHeaders({ token: opts.token, json: false }) })
    return parseV1(response, url)
}
/**
 * Wie {@link get}, cacht das Ergebnis aber für ```ttl``` Sekunden (Cache-Key inkl. Token, damit
 * nutzerspezifische Antworten nicht geteilt werden).
 */
async function getAndCache(path, ttl = null, opts = {}){
    const url = apiUrl(path)
    const cacheKey = (opts.token ? "t:" : "") + url
    if(sessionCache.has(cacheKey)){
        console.log("getAndCache: got data from cache for:", url)
        return sessionCache.get(cacheKey)
    }
    const data = await get(path, opts)
    sessionCache.set(cacheKey, data, ttl || 30)
    console.log("getAndCache: cached data from url:", url)
    return data
}
/**
 * POST (JSON-Body) auf einen /v1-relativen (oder absoluten) Pfad. Hängt Bearer-Token (falls
 * übergeben) und den Launcher-Schlüssel an, parst das v1-Envelope. Wirft ApiError bei Ablehnung.
 * @param {string} path
 * @param {JSON} data
 * @param {{ token?: string|null }} [opts]
 */
async function send(path, data, opts = {}){
    const url = apiUrl(path)
    const method = opts.method || "post"
    const response = await fetch(url, { method, body: JSON.stringify(data || {}), headers: apiHeaders({ token: opts.token }) })
    console.log("send:", method.toUpperCase(), url)
    return parseV1(response, url)
}
/**
 * GraphQL-POST auf /v1/catalog/graphql. Braucht einen store:read-Credential — der Launcher nutzt
 * die Session (Bearer). Wirft bei GraphQL-Fehlern.
 */
async function graphql(query, variables = {}, opts = {}){
    const url = apiUrl("/v1/catalog/graphql")
    const response = await fetch(url, { method: "post", body: JSON.stringify({ query, variables }), headers: apiHeaders({ token: opts.token }) })
    let body = null
    try{ body = await response.json() }catch(e){}
    if(!response.ok) throw new ApiError((body && body.errors && body.errors[0] && body.errors[0].message) || ("HTTP " + response.status), response.status)
    if(body && body.errors && body.errors.length) throw new ApiError(body.errors[0].message, response.status, "GRAPHQL")
    return body && body.data
}
/**
 * Lädt das Cover eines installierten Spiels (```product.thumbnail```, API-relativ z.B.
 * "/media/games/<id>.svg" oder absolut) in den Installationsordner — für die Offline-Anzeige
 * in der Bibliothek. BEWUSST nicht-fatal: ein fehlendes/nicht ladbares Cover darf eine
 * Installation nie scheitern lassen. Speichert unter "image.<ext>" (Endung aus der URL) und
 * merkt sich den Dateinamen auf ```product.img``` für /api/library/img.
 * @param {{ thumbnail?: string, installationPath: string, name: string, img?: string }} product
 * @returns {Promise<void>} resolved immer (Fehler werden nur geloggt)
 */
async function downloadCoverImage(product){
    try{
        if(!product || typeof product.thumbnail !== "string" || !product.thumbnail.trim()){
            console.log("downloadCoverImage: no thumbnail for", product && product.name, "- skipping")
            return
        }
        const url = apiUrl(product.thumbnail)
        const response = await fetch(url)
        if(!response.ok){
            console.warn("downloadCoverImage: fetch failed", url, response.status)
            return
        }
        const ext = (path.extname(new URL(url).pathname) || ".png").toLowerCase()
        const fileName = "image" + ext
        const buffer = Buffer.from(await response.arrayBuffer())
        // Läuft VOR dem Entpacken (damit product.img in der Registry landet) — Ordner ggf. anlegen.
        await fs.promises.mkdir(product.installationPath + product.name, { recursive: true })
        await fs.promises.writeFile(product.installationPath + product.name + "/" + fileName, buffer)
        product.img = fileName
        console.log("downloadCoverImage: saved", fileName, "for", product.name)
    }
    catch(err){
        console.warn("downloadCoverImage: failed for", product && product.name, err && err.message)
    }
}
const { getDataKey } = require("./dataKey")
const algorithm = "aes-256-gcm"
/**
 * Encrypts ```data``` with authenticated AES-256-GCM using the per-installation
 * data key (see ```dataKey.js```). The auth tag makes tampering detectable on
 * decrypt. Format: ```gcm$<iv>$<authTag>$<ciphertext>``` (all hex).
 * @param {string | number | boolean | JSON} data the data that should be encrypted
 * @returns {string} the encrypted data
 */
function encrypt(data){
    const iv = crypto.randomBytes(12) // 96-bit nonce, recommended for GCM
    const cipher = crypto.createCipheriv(algorithm, getDataKey(), iv)
    const encrypted = Buffer.concat([cipher.update(String(data), "utf8"), cipher.final()])
    const authTag = cipher.getAuthTag()
    return "gcm$" + iv.toString("hex") + "$" + authTag.toString("hex") + "$" + encrypted.toString("hex")
}
/**
 * Decrypts data produced by ```encrypt```. Throws if the format is unknown
 * (e.g. legacy CTR data from older versions) or if the auth tag does not match
 * (tampered/corrupted file); callers fall back to defaults / re-login in that case.
 * @param {string} data the data that should be decrypted
 * @returns {string} the decrypted data
 */
function decrypt(data){
    const parts = typeof data === "string" ? data.split("$") : []
    if(parts[0] !== "gcm" || parts.length !== 4){
        throw new Error("decrypt: unsupported or legacy ciphertext format")
    }
    const iv = Buffer.from(parts[1], "hex")
    const authTag = Buffer.from(parts[2], "hex")
    const encryptedData = Buffer.from(parts[3], "hex")
    const decipher = crypto.createDecipheriv(algorithm, getDataKey(), iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
    return decrypted.toString("utf8")
}
/**
 * check the connection between the client and the server api.sketch-company.de and the internet
 * @param {number | null} timeout the time after the check will be canceled
 * @returns {Promise<number>} the status of the internet connection and the server connection to api.sketch-company.de. 
 * Returns 2 if connected to internet and server, 1 if connected to internet but not the server and 0 if none so no internet or server connection is given
 */
function checkInternetConnection(timeout){
    return new Promise(cb => {
        // Erreicht der API-Ping den Host nicht, unterscheiden wir „Server down" (Internet da) von
        // „wirklich offline" über die OS-Netzlage (electron.net.isOnline, wie navigator.onLine) —
        // sonst würde der Nutzer fälschlich für seine Verbindung verantwortlich gemacht.
        const onFail = () => {
            let online = false
            try{ online = electron.net.isOnline() }catch(e){ /* Fallback: unten 0 */ }
            cb(online ? 1 : 0) // 1 = Internet, aber Server nicht erreichbar; 0 = offline
        }
        try{
            if(!timeout) timeout = 3000
            fetch(apiUrl("/status"), {signal: AbortSignal.timeout(timeout)}).then(async (response) => {
                let json = await response.json()
                if(json.status == 1 && json.data == "connected"){
                    console.log("checkInternetConnection: connected")
                    cb(2) // connected to internet and server
                }
                else cb(1) // connected to internet but not server

            }).catch((err) => {
                console.log("checkInternetConnection: error on request:", err)
                onFail()
            })
        }
        catch(err){
            console.log("checkInternetConnection: error when starting request:", err)
            onFail()
        }
    })
}

/**
 * Launches an installed product in a cross-platform way. On macOS the executable
 * is a ```.app``` bundle, which must be opened via ```open```; on Windows/Linux
 * the binary is spawned directly. Returns the spawned ChildProcess so callers can
 * attach ```spawn```/```error```/```close``` listeners.
 * @param {string} filepath path to the executable / .app bundle
 * @returns {import("child_process").ChildProcess}
 */
function launchProgram(filepath){
    if(process.platform === "darwin"){
        // Für echtes Playtime-Tracking die tatsächliche Bundle-Binary starten (statt `open`, das
        // sofort zurückkehrt) — so feuert das close-Event beim echten Spielende. Bei Fehlschlag
        // Fallback auf `open` (Start funktioniert weiter, nur ohne Zeitmessung).
        if(filepath.endsWith(".app")){
            const exe = resolveMacExecutable(filepath)
            if(exe) return child_process.spawn(exe, { detached: true, cwd: path.dirname(exe) })
        }
        return child_process.spawn("open", [filepath], { detached: true })
    }
    return child_process.spawn(filepath, { detached: true, cwd: path.dirname(filepath) })
}
/**
 * Löst die ausführbare Binary innerhalb eines macOS-.app-Bundles auf (Contents/MacOS/<CFBundleExecutable>).
 * Kein XML-Parser nötig — CFBundleExecutable wird per Regex aus Info.plist gelesen; Fallbacks: einzige
 * bzw. erste Datei in Contents/MacOS/. Gibt null zurück, wenn nichts Passendes gefunden wird.
 * @param {string} appPath Pfad zum .app-Bundle
 * @returns {string|null}
 */
function resolveMacExecutable(appPath){
    try{
        const macosDir = path.join(appPath, "Contents", "MacOS")
        if(!fs.existsSync(macosDir)) return null
        let exec = null
        try{
            const plist = fs.readFileSync(path.join(appPath, "Contents", "Info.plist"), "utf8")
            const m = plist.match(/<key>\s*CFBundleExecutable\s*<\/key>\s*<string>([^<]+)<\/string>/)
            if(m) exec = m[1].trim()
        }
        catch{ /* keine/kaputte Info.plist → Fallback unten */ }
        if(exec){
            const p = path.join(macosDir, exec)
            if(fs.existsSync(p)) return p
        }
        const entries = fs.readdirSync(macosDir).filter(e => !e.startsWith("."))
        if(entries.length === 1) return path.join(macosDir, entries[0])
        for(const e of entries){
            const p = path.join(macosDir, e)
            try{ if(fs.statSync(p).isFile()) return p }catch{ /* skip */ }
        }
        return null
    }
    catch{ return null }
}
/**
 * Opens a URL in the user's default browser via Electron's shell (replaces the
 * `open` npm package and works on every platform).
 * @param {string} url
 * @returns {Promise<void>}
 */
function openExternal(url){
    return electron.shell.openExternal(url)
}

module.exports = {
    write,
    read,
    remove,
    exists,
    copy,
    move,
    mkDir,
    readDir,
    get,
    getAndCache,
    send,
    graphql,
    ApiError,
    encrypt,
    decrypt,
    checkInternetConnection,
    minimize,
    hideToBackground,
    quitLauncher,
    sendNotification,
    createShortcut,
    launchProgram,
    openExternal,
    showDialog,
    showMessageBox,
    showErrorBox,
    redirect,
    getRepository,
    downloadCoverImage,
}