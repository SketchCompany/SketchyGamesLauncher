const path = require("path")
const {app} = require("electron")

/**
 * ```PORT``` sets the port for the server / backend of the application.
 */
const PORT = 3000
/**
 * ```defaultDir``` is the path, used to get other files or directorys out of the main directory
 */
const defaultDir = app.isPackaged ? path.parse(app.getPath("exe")).dir : __dirname
/**
 * ```base``` is the path, used to access files in the frontend.
 */
const base = __dirname + "/frontend/"
/**
 * ```resources``` is the path, where all the resources are located.
 */
const resources = base + "res/"
/**
 * ```installs``` is the path, where the downloads get unpacked and installed to.
 */
const installs = defaultDir + "/installs/"
/**
 * ```downloads``` is the path, where the downloads are downloaded first, before they get unpacked and install to the ```installs``` directory.
 */
const downloads = defaultDir + "/downloads/"
/**
 * ```data``` is the path, where all the important data gets saved to.
 */
const data = defaultDir + "/data/"
/**
 * ```ext``` is the file extension for files that keep important data.
 */
const ext = ".data"
/**
 * ```appExt``` is the file extension for files that will be stared, when the user starts an application in the library.
 */
const appExt = ".exe"
/**
 * ```imgFile``` is the file name for the image for the game when in offline mode.
 */
const imgFile = "image.png"
/**
 * ```updatesFile``` is the file name for the updates that should be done.
 */
const updatesFile = data + "updates" + ext
// /**
//  * ```iconFile``` is the file name for the icon of the game for a shortcut.
//  */
// const iconFile = "icon.ico"
/**
 * ```packageExt``` is the file extension for files that are downloaded from the server and contain the important application files.
 */
const packageExt = ".zip"
/**
 * ```installsFile``` is the path, where all installs are tracked.
 */
const installsFile = data + "installs" + ext
/**
 * ```userFile``` is the path, where the user data is tracked.
 */
const userFile = data + "user" + ext
/**
 * ```settingsFile``` is the path, where the settings of the launcher are tracked.
 */
const settingsFile = data + "settings" + ext

async function setup(){
    return new Promise(async cb => {
        console.log("setup: started")
        const func = require("./functions")
        console.log("setup: defaultDir", defaultDir)
        // setup paths and files
        if(!func.exists(installs)) await func.mkDir(installs)
        if(!func.exists(downloads)) await func.mkDir(downloads)
        if(!func.exists(data)) await func.mkDir(data)
        if(!func.exists(installsFile)) await func.write(installsFile, JSON.stringify({
            games: [],
            softwares: [],
            other: []
        }, null, 3))
        if(!func.exists(userFile)) await func.write(userFile, func.encrypt(JSON.stringify({
            id: "",
            user: "",
            email: "",
            password: ""
        })))
        if(!func.exists(settingsFile)) await func.write(settingsFile, func.encrypt(JSON.stringify({
            installationPath: installs,
            notifications: true,
            loginOnStartup: true,
            actionAfterGameStarted: 1
        })))
        if(!func.exists(updatesFile)) await func.write(updatesFile, JSON.stringify({
            updates: []
        }, null, 3))

        // clean downloads folder
        const downloadFiles = await func.readDir(downloads)
        if(downloadFiles.length > 0){
            downloadFiles.forEach(async (file) => {
                await func.remove(downloads + "/" + file)
            })
            console.log("setup: cleaned downloads folder")
        }

        // check for updates
        const status = await func.checkInternetConnectivity()
        if(status == 2){
            await checkForUpdates()
        }
        else if(status == 1) console.log("setup: no connection to sketch-company.de servers")
        else if(status == 0) console.log("setup: no connection to the internet")
        console.log("setup: finished")
        cb()
    })
}
async function checkForUpdates(){
    return new Promise(async cb => {
        const func = require("./functions")
        //const api = require("./api")
        const installs = JSON.parse(await func.read(installsFile))
        const updates = JSON.parse(await func.read(updatesFile))
        // const launcherData = await func.get("https://api.sketch-company.de/launcher")
        // if(launcherData.version != VERSION){
        //     console.log("checkForUpdates: found an update for the launcher", launcherData.version)
        //     api.downloadQueue.push({
        //         downloadUrl: launcherData.downloadUrl,
        //         version: launcherData.version,
        //         name: "Sketchy Games Launcher",
        //         description: "The official Sketchy Games Launcher. Version " + launcherData.version,
        //         versionLevel: "",
        //         patchNotes: [{version: launcherData.version, notes: "Update to version " + launcherData.version}],
        //         isLauncher: true,
        //         categorie: "softwares"
        //     })
        //     if(!api.isDownloading) api.download()
        // }
        // else console.log("checkForUpdates: no update for the launcher was found")
        const storeProducts = await func.get("https://api.sketch-company.de/store")
        if(installs.games.length > 0){
            for (let i = 0; i < installs.games.length; i++) {
                const element = installs.games[i];
                const onlineElement = storeProducts.games[i]
                if(element.name == onlineElement.name && onlineElement.version != onlineElement.version){
                    console.log("checkForUpdates: found update for", element.name)
                    console.log("checkForUpdates: from", element.version, "to", onlineElement.version)
                    updates.push(req.body)
                    console.log("checkForUpdates: pushed to updatesFile", updates.updates)
                }
            }
            console.log("checkForUpdates: no updates found for games")
        }
        else console.log("checkForUpdates: no updates found for games")
        if(installs.softwares.length > 0){
            for (let i = 0; i < installs.softwares.length; i++) {
                const element = installs.softwares[i];
                const onlineElement = storeProducts.softwares[i]
                if(element.name == onlineElement.name && onlineElement.version != onlineElement.version){
                    console.log("checkForUpdates: found update for", element.name)
                    console.log("checkForUpdates: from", element.version, "to", onlineElement.version)
                    updates.updates.push(req.body)
                    console.log("checkForUpdates: pushed to updatesFile", updates.updates)
                }
            }
            console.log("checkForUpdates: no updates found for softwares")
        }
        else console.log("checkForUpdates: no updates found for softwares")
        if(updates.updates.length > 0){
            await func.write(JSON.stringify(updates))
            console.log("checkForUpdates: wrote updates to updatesFile")
        }
        cb()
    })
}

module.exports = {
    PORT,
    base,
    resources,
    installs,
    downloads,
    data,
    ext,
    appExt,
    imgFile,
    packageExt,
    installsFile,
    userFile,
    settingsFile,
    updatesFile,
    setup,
    checkForUpdates
}