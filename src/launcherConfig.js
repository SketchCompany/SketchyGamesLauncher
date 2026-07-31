const {app} = require("electron")
const path = require("path")
const { platform } = require("process")

/**
 * ```requestToken``` used to set as cookie on the client and make sure the website is only accessible through electron.
 */
const requestToken = "SketchyGamesLauncher"
/**
 * ```PORT``` sets the port for the server / backend of the application.
 */
let PORT = 1520
/**
 * ```globalDir``` is the path, used to store any data globally on the computer and access from every version of the launcher.
 */
const globalDir = path.parse(app.getPath("userData")).dir + "/Sketchy Games Launcher/"
/**
 * ```defaultDir``` is the path, used to get other files or directorys out of the main directory.
 */
const defaultDir = app.isPackaged ? path.parse(app.getPath("exe")).dir : __dirname
/**
 * ```logFile``` is the file name to the log file where all logs are saved.
 * MUSS in einem beschreibbaren Verzeichnis liegen — NICHT neben der Executable: auf gepacktem
 * macOS ist das .app-Bundle read-only. Deshalb im geteilten, beschreibbaren globalDir/data.
 */
const logFile = globalDir + "/data/launcher.log"
/**
 * ```base``` is the path, used to access files in the frontend.
 */
const base = __dirname + "/frontend/"
/**
 * ```resources``` is the path, where all the resources are located.
 */
const resources = base + "res/"
/**
 * ```dist``` is the path of the built React SPA (Vite output). Express serves
 * these static assets and uses an index.html SPA fallback for app routes.
 */
const dist = __dirname + "/frontend-dist/"
/**
 * ```installs``` is the path, where the downloads get unpacked and installed to.
 */
let installs = globalDir + "/installs/"
/**
 * ```downloads``` is the path, where the downloads are downloaded first, before they get unpacked and install to the ```installs``` directory.
 * Liegt im beschreibbaren globalDir (NICHT neben der Executable) — auf gepacktem macOS ist das
 * .app-Bundle read-only, ein Download-Ordner daneben würde fehlschlagen.
 */
const downloads = globalDir + "/downloads/"
/**
 * ```data``` is the path, where all the important data gets saved to.
 */
const data = globalDir + "/data/"
/**
 * ```ext``` is the file extension for files that keep important data.
 */
const ext = ".data"
/**
 * ```appExt``` is the file extension of the executable that gets started when the
 * user launches an application in the library. Platform dependent: ```.exe``` on
 * Windows, ```.app``` bundle on macOS, no extension on Linux.
 */
const appExt = platform === "win32" ? ".exe" : platform === "darwin" ? ".app" : ""
/**
 * ```imgFile``` is the file name for the image for the game when in offline mode.
 */
const imgFile = "image.png"
/**
 * ```updatesFile``` is the file name for the updates that should be done.
 */
const updatesFile = data + "updates" + ext
/**
 * ```packageExt``` is the file extension for files that are downloaded from the server and contain the important application files.
 */
const packageExt = ".zip"
/**
 * ```installsFile``` is the path, where all installs are tracked.
 */
const installsFile = data + "installs" + ext
/**
 * ```playtimesFile``` trackt die lokale Spielzeit je Spiel (Basis fürs 15-Min-Gate der Rezensionen).
 * Reines JSON: { "<gameId>": { seconds, sessions, lastPlayed } }. Keine Sicherheitsgrenze.
 */
const playtimesFile = data + "playtimes" + ext
/**
 * ```notificationsFile``` speichert die persistenten Benachrichtigungen (Glocken-Fenster), damit
 * sie einen Neustart überleben. Reines JSON: { notifications: [...] }. Keine Sicherheitsgrenze.
 */
const notificationsFile = data + "notifications" + ext
/**
 * ```userFile``` is the path, where the user data is tracked.
 */
const userFile = data + "user" + ext
/**
 * ```settingsFile``` is the path, where the settings of the launcher are tracked.
 */
const settingsFile = data + "settings" + ext
/**
 * ```settingsIntegrity``` is the default JSON object for the settings
 */
const settingsIntegrity = {
    installationPath: installs,
    notifications: true,
    desktopNotifications: true,
    loginOnStartup: true,
    actionAfterGameStarted: 1,
    console: false,
    // Offlinemodus: ohne Anmeldung nur installierte Spiele spielen; Online-Bereiche deaktiviert.
    offlineMode: false,
    // Zuletzt gesehene Launcher-Version. Weicht sie von der laufenden ab, hebt der
    // Neuigkeiten-Feed die Versionshinweise als „gerade installiert" hervor (siehe /api/news).
    lastSeenLauncherVersion: "",
}
/**
 * Bringt ein (evtl. manipuliertes/veraltetes) Settings-Objekt auf die bekannte Form: NUR bekannte
 * Keys werden übernommen (unbekannte wie das reine Anzeige-Feld `version` fallen weg — Manipulations-
 * schutz), fehlende Keys mit Defaults gefüllt (zukunftssicher beim Ergänzen neuer Optionen, ohne die
 * Nutzer-Einstellungen zu verwerfen). Nie werfen.
 */
function sanitizeSettings(obj){
    const clean = {}
    for(const key of Object.keys(settingsIntegrity)){
        clean[key] = (obj && Object.prototype.hasOwnProperty.call(obj, key)) ? obj[key] : settingsIntegrity[key]
    }
    return clean
}

/**
 * Schneller, rein lokaler Teil des Setups (einstellige Millisekunden, KEIN Netzwerk):
 * Verzeichnisse + Datendateien anlegen und die Einstellungen laden (setzt u.a. den
 * Installationspfad, den /download braucht). Läuft VOR der ersten Navigation des Fensters.
 */
async function setupPaths(){
  try{
        console.log("setupPaths: started")
        const func = require("./functions")
        console.log("setupPaths: defaultDir", defaultDir)
        console.log("setupPaths: globalDir", globalDir)

        if(!func.exists(installs)) await func.mkDir(installs)
        if(!func.exists(downloads)) await func.mkDir(downloads)
        if(!func.exists(data)) await func.mkDir(data)
        // Registry-Form: nur noch `games` + `other` (die frühere `softwares`-Kategorie ist
        // entfernt; alte Dateien mit dem Schlüssel werden toleriert und ignoriert).
        if(!func.exists(installsFile)) await func.write(installsFile, JSON.stringify({
            games: [],
            other: []
        }, null, 3))
        if(!func.exists(settingsFile)) await func.write(settingsFile, func.encrypt(JSON.stringify(settingsIntegrity)))
        else await loadSettings()
        if(!func.exists(updatesFile)) await func.write(updatesFile, JSON.stringify({
            updates: []
        }, null, 3))
        if(!func.exists(playtimesFile)) await func.write(playtimesFile, JSON.stringify({}, null, 3))
        if(!func.exists(notificationsFile)) await func.write(notificationsFile, JSON.stringify({ notifications: [] }, null, 3))
        console.log("setupPaths: finished")
  }
  catch(err){
        console.error("setupPaths: failed:", err)
  }
}

/**
 * Netzwerk-/wartungslastiger Teil des Setups — läuft NACH dem ersten Fensteraufbau im
 * Hintergrund (setImmediate in index.js), damit der Start nie auf das Netz wartet:
 * Verbindungsprüfung, Downloads-Ordner aufräumen (Resume-Zustand bleibt erhalten!),
 * verwaiste Installationen entfernen, fehlende Cover nachladen, Update-Check und
 * unterbrochene Downloads fortsetzen.
 */
async function setupBackground(){
  try{
        console.log("setupBackground: started")
        const func = require("./functions")

        const status = await func.checkInternetConnection()
        const online = status == 2
        if(status == 1) console.log("setupBackground: no connection to sketch-company.de servers")
        else if(status == 0) console.log("setupBackground: no connection to the internet")

        // Downloads-Ordner aufräumen — aber NUR Dateien ohne zugehörigen Resume-Zustand.
        // Ein <name>.zip oder .sgl-part MIT <name>.state.json gehört zu einem unterbrochenen
        // Download und wird von resumeInterrupted() weiterverwendet.
        const downloadFiles = await func.readDir(downloads)
        const stateNames = new Set(downloadFiles.filter(f => f.endsWith(".state.json")).map(f => f.slice(0, -".state.json".length)))
        for(const file of downloadFiles){
            if(file.endsWith(".state.json")) continue
            const base = file.endsWith(packageExt) ? file.slice(0, -packageExt.length) : null
            if(base && stateNames.has(base)) continue
            await func.remove(downloads + "/" + file).catch(() => {})
        }

        // Verwaiste Installationen entfernen + fehlende Cover nachladen.
        const installedProducts = JSON.parse(await func.read(installsFile))
        if(!Array.isArray(installedProducts.games)) installedProducts.games = []
        for (let i = installedProducts.games.length - 1; i >= 0; i--) {
            const element = installedProducts.games[i];
            if(!func.exists(element.start)){
                console.log("setupBackground: could not find executable for", element.name, "deleting from installs file")
                if(func.exists(path.dirname(element.start))){
                    await func.remove(path.dirname(element.start))
                }
                installedProducts.games.splice(i, 1)
            }
            else if(online && !func.exists(element.installationPath + "/" + element.name + "/" + (element.img || imgFile))){
                console.log("setupBackground: could not find cover image for", element.name, "downloading from", element.thumbnail)
                await func.downloadCoverImage(element)
            }
        }
        await func.write(installsFile, JSON.stringify(installedProducts, null, 3))

        if(online){
            // Lizenzen des angemeldeten Kontos spiegeln, BEVOR der Update-Check läuft — der
            // filtert danach fremde Installationen heraus (siehe checkForUpdates).
            const session = require("./session")
            const token = session.getToken()
            if(token) await require("./ownership").sync(token, session.getUserId())

            console.log("setupBackground: checking for updates")
            await checkForUpdates()
            // Unterbrochene Downloads (Crash/Netzabbruch/Beenden) fortsetzen.
            await require("./downloadEngine").resumeInterrupted()
            // Store-Cache vorwärmen: die Store-Seite rendert dann sofort (Skeleton nur bei Kaltstart).
            if(token) await require("./storeAdapter").getStore(token).catch(() => {})
        }

        console.log("setupBackground: finished")
  }
  catch(err){
        console.error("setupBackground: failed:", err)
  }
}

// Komposition für Alt-Aufrufer (nur index.js nutzt setup()); neuer Startpfad ruft beide getrennt.
async function setup(){
    await setupPaths()
    await setupBackground()
}
async function checkForUpdates(){
  try{
        const func = require("./functions")
        const updates = []

        // read installed games
        const installs = JSON.parse(await func.read(installsFile))
        if(!Array.isArray(installs.games) || installs.games.length === 0){
            console.log("checkForUpdates: no games installed to check")
            return updates
        }

        // Update-Quelle ist der Build-Katalog der API (/v1/launcher/builds: version/sha256 pro
        // Spiel-Id, bereits plattformgefiltert) — der GraphQL-Katalog exportiert keine Version.
        const session = require("./session")
        const storeAdapter = require("./storeAdapter")
        const token = session.getToken()
        if(!token){
            console.log("checkForUpdates: nicht angemeldet, Update-Prüfung übersprungen")
            return updates
        }
        const builds = await storeAdapter.fetchBuilds(token)
        // Nur eigene Spiele: für eine Installation ohne Lizenz des aktuellen Kontos darf weder ein
        // updatesFile-Eintrag noch eine „Update verfügbar"-Meldung entstehen (sie würde die
        // Bibliothek eines anderen Kontos verraten und ins Leere führen).
        const ownership = require("./ownership")

        for (const element of installs.games) {
            if(!ownership.owns(element.name)) continue
            console.log("checkForUpdates: checking", element.name)
            const build = builds.get(element.name)
            // Installationen ohne aufgezeichnete Version (Alt-Installationen) werden übersprungen,
            // damit keine falschen Updates gemeldet werden.
            if(build && build.version && element.version && build.version !== element.version){
                console.log("checkForUpdates: found update for", element.name, "from", element.version, "to", build.version)
                updates.push({
                    id: element.name,
                    name: element.name,
                    title: element.title || element.name,
                    version: build.version,
                    sha256: build.sha256,
                    thumbnail: element.thumbnail,
                    installationPath: element.installationPath,
                    categorie: "games"
                })
            }
        }

        // IMMER schreiben (auch leer): updatesFile ist die Wahrheit für den „Aktualisieren"-Knopf
        // der Produktseite. Würde nur bei Treffern geschrieben, bliebe ein erledigtes Update ewig
        // stehen — vorher hat das niemand aufgeräumt (/api/updates/clear hat keinen Aufrufer).
        await func.write(updatesFile, JSON.stringify({updates}, null, 3))
        if(updates.length > 0){
            console.log("checkForUpdates: wrote updates to updatesFile")
            // Persistente Benachrichtigung je verfügbarem Spiel-Update (idempotent per key).
            try{
                const notificationStore = require("./notificationStore")
                for(const u of updates){
                    await notificationStore.add({
                        key: "update:" + u.id,
                        type: "note",
                        title: "Update verfügbar",
                        message: `Für „${u.title || u.name}" ist ein Update verfügbar.`,
                        actions: [{ kind: "navigate", to: "/store/" + encodeURIComponent(u.id), label: "Jetzt aktualisieren" }],
                    }, { os: true })
                }
            }
            catch(err){ console.error("checkForUpdates: notification failed:", err) }
        }
        else console.log("checkForUpdates: no updates found")
        return updates
  }
  catch(err){
        console.error("checkForUpdates: failed:", err)
        return []
  }
}
function loadSettings(){
    return new Promise(async cb => {
        try{
            const func = require("./functions")
            try{
                // Gespeicherte Werte auf die bekannte Form normalisieren (unbekannte Keys raus,
                // fehlende mit Defaults auffüllen) statt bei Abweichung ALLES zurückzusetzen — so
                // gehen beim Ergänzen neuer Optionen keine Nutzer-Einstellungen verloren.
                const raw = JSON.parse(func.decrypt(await func.read(settingsFile)))
                const settings = sanitizeSettings(raw)
                installs = settings.installationPath
                // Nur zurückschreiben, wenn sich durch die Normalisierung etwas geändert hat.
                if(JSON.stringify(raw) !== JSON.stringify(settings)){
                    await func.write(settingsFile, func.encrypt(JSON.stringify(settings, null, 3)))
                    console.log("loadSettings: normalized settings file")
                }
                else console.log("loadSettings: correct")
            }
            catch(err){
                await func.write(settingsFile, func.encrypt(JSON.stringify(settingsIntegrity, null, 3)))
                const settings = settingsIntegrity
                console.log("loadSettings: incorrect when decrypting settingsFile at", settingsFile, "fixed by overwriting settingsFile and using settingsIntegrity object")
                installs = settings.installationPath
            }
            cb()
        }
        catch(err){
            console.error("loadSettings:", err)
            cb(err)
        }
    })
}
module.exports = {
    requestToken,
    PORT,
    logFile,
    base,
    resources,
    dist,
    installs,
    downloads,
    data,
    ext,
    appExt,
    imgFile,
    packageExt,
    installsFile,
    playtimesFile,
    notificationsFile,
    userFile,
    settingsFile,
    updatesFile,
    settingsIntegrity,
    sanitizeSettings,
    setup,
    setupPaths,
    setupBackground,
    checkForUpdates,
}