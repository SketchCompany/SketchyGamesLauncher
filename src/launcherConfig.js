const {app} = require("electron")
const https = require("https")
const fs = require("fs")
const path = require("path")
const { platform } = require("process")

/**
 * ```platform``` defines on which os the launcher is operating
 */
const PLATFORM = "macOS"
/**
 * ```roles``` are the available roles for every user to find matching rules and make individuals have specific rights
 */
const ROLES = {
    admin: "Admin",
    dev: "Dev",
    user: "User"
}
/**
 * ```levels```
 */
const LEVELS = {
    admin: 100,
    dev: 50,
    user: 1
}
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
 */
const logFile = defaultDir + "/launcher.log"
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
let installs = globalDir + "/installs/"
/**
 * ```downloads``` is the path, where the downloads are downloaded first, before they get unpacked and install to the ```installs``` directory.
 */
const downloads = defaultDir + "/downloads/"
/**
 * ```data``` is the path, where all the important data gets saved to.
 */
const data = globalDir + "/data/"
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
}

async function setup(){
    return new Promise(async cb => {
        console.log("setup: started")

        const func = require("./functions")
        console.log("setup: defaultDir", defaultDir)
        console.log("setup: globalDir", globalDir)

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
        }, null, 3)))
        else{
            // update existing account data to ensure the user is up to date
            const status = await func.checkInternetConnection()
            if(status == 2){
                console.log("setup: updating account data")
                //await updateAccountData()
            }
            else if(status == 1) console.log("setup: no connection to sketch-company.de servers")
            else if(status == 0) console.log("setup: no connection to the internet")
        }
        if(!func.exists(settingsFile)) await func.write(settingsFile, func.encrypt(JSON.stringify(settingsIntegrity)))
        else{
            await loadSettings()
        }
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

        // check if installs file is up to date and delete games or softwares if there is no .exe file and if needed download the cover image for each game and software
        const installedProducts = JSON.parse(await func.read(installsFile))
        if(installedProducts.games.length > 0){
            for (let i = 0; i < installedProducts.games.length; i++) {
                const element = installedProducts.games[i];
                if(!func.exists(element.start)){
                    console.log("setup: could not find .exe for", element.name, "deleting from installs file")
                    if(func.exists(path.dirname(element.start))){
                        await func.remove(path.dirname(element.start))
                    }
                    installedProducts.games.splice(i, 1)
                }
                else if(!func.exists(element.installationPath + "/" + element.name + "/image.png")){
                    const status = await func.checkInternetConnection()
                    if(status == 2){
                        console.log("setup: could not find image.png for", element.name, "downloading new cover image from", element.resourcesUrl + "/1.png")
                        console.log("setup:", element.installationPath + "/image.png")
                        await downloadImage(element)
                    }
                    else console.log("setup: no internet or server connection to download the cover image for", element.name)

                }
            }
        }
        if(installedProducts.softwares.length > 0){
            for (let i = 0; i < installedProducts.softwares.length; i++) {
                const element = installedProducts.softwares[i];
                if(!func.exists(element.start)){
                    console.log("setup: could not find .exe for", element.name, "deleting from installs file")
                    if(func.exists(path.dirname(element.start))){
                        await func.remove(path.dirname(element.start))
                    }
                    installedProducts.softwares.splice(i, 1)
                }
                else if(!func.exists(element.installationPath + "/" + element.name + "/image.png")){
                    const status = await func.checkInternetConnection()
                    if(status == 2){
                        console.log("setup: could not find image.png for", element.name, "downloading new cover image from", element.resourcesUrl + "/1.png")
                        console.log("setup:", element.installationPath + "/image.png")
                        await downloadImage(element)
                    }
                    else console.log("setup: no internet or server connection to download the cover image for", element.name)
                }
            }
        }
        await func.write(installsFile, JSON.stringify(installedProducts, null, 3))

        // check for updates
        const status = await func.checkInternetConnection()
        if(status == 2){
            console.log("setup: checking for updates")
            await checkForUpdates()
        }
        else if(status == 1) console.log("setup: no connection to sketch-company.de servers")
        else if(status == 0) console.log("setup: no connection to the internet")

        console.log("setup: finished")
        cb()
    })
}
async function downloadImage(product){
    console.log("downloadImage: started for", product.resourcesUrl + "1.png")
    return new Promise(cb => {
        https.get(product.resourcesUrl + "1.png", (response) => {
            const writeStream = fs.createWriteStream(product.installationPath + product.name + "/" + imgFile)
            response.pipe(writeStream)
            writeStream.on("finish", function(){
                writeStream.close()
                console.log("downloadImage: finished for", product.resourcesUrl + "1.png")
                cb()
            })
        })
    })
}
function checkForUpdates(){
    return new Promise(async cb => {
        const func = require("./functions")
        const updates = []
        
        // read installed games
        const installs = JSON.parse(await func.read(installsFile))

        // get latest information from the store api
        const storeProducts = await func.getAndCache("https://api.sketch-company.de/store", 60)

        // check installed games for updates
        if(installs.games.length > 0){
            for (let i = 0; i < installs.games.length; i++) {
                const element = installs.games[i];
                console.log("checkForUpdates: checking", element.name)
                for (let i2 = 0; i2 < storeProducts.games.length; i2++) {
                    const onlineElement = storeProducts.games[i2];
                    if(element.name == onlineElement.name && element.version != onlineElement.version){
                        console.log("checkForUpdates: found update for", element.name)
                        console.log("checkForUpdates: from", element.version, "to", onlineElement.version)
                        onlineElement.installationPath = element.installationPath
                        onlineElement.categorie = "games"
                        updates.push(onlineElement)
                        //console.log("checkForUpdates: pushed to updatesFile", updates)
                    }
                }
            }
        }
        else console.log("checkForUpdates: no games installed to check")

        // check installed softwares for updates
        if(installs.softwares.length > 0){
            for (let i = 0; i < installs.softwares.length; i++) {
                const element = installs.softwares[i];
                console.log("checkForUpdates: checking", element.name)
                for (let i2 = 0; i2 < storeProducts.softwares.length; i2++) {
                    const onlineElement = storeProducts.softwares[i2];
                    if(element.name == onlineElement.name && element.version != onlineElement.version){
                        console.log("checkForUpdates: found update for", element.name)
                        console.log("checkForUpdates: from", element.version, "to", onlineElement.version)
                        onlineElement.installationPath = element.installationPath
                        onlineElement.categorie = "softwares"
                        updates.push(onlineElement)
                        //console.log("checkForUpdates: pushed to updatesFile", updates)
                    }
                }
            }
        }
        else console.log("checkForUpdates: no softwares installed to check")

        if(updates.length > 0){
            await func.write(updatesFile, JSON.stringify({updates}, null, 3))
            console.log("checkForUpdates: wrote updates to updatesFile")
        }
        else console.log("checkForUpdates: no updates found")

        cb()
    })
}
function loadSettings(){
    return new Promise(async cb => {
        try{
            const func = require("./functions")
            try{
                const settings = JSON.parse(func.decrypt(await func.read(settingsFile)))
                if(func.checkForIntegrity(settings, settingsIntegrity)){
                    console.log("loadSettings: correct")
                    installs = settings.installationPath
                }
                else{
                    console.log("loadSettings: incorrect")
                    await func.write(settingsFile, func.encrypt(JSON.stringify(settingsIntegrity, null, 3))) // replace settings file with default settings
                }
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
function updateAccountData(){
    return new Promise(async cb => {
        try{
            const func = require("./functions")
            const raw = await func.read(userFile)
            const oldUserData = JSON.parse(func.decrypt(raw))
            const response = await func.send("https://api.sketch-company.de/u/find", {id: oldUserData.id})
            await func.write(userFile, func.encrypt(JSON.stringify(response, null, 3)))
            console.log("updateAccountUpdate: updated account", response.user, "successfully")
            cb()
        }
        catch(err){
            console.error("updateAccountUpdate:", err)
            cb(err)
        }
    })
}

module.exports = {
    PLATFORM,
    ROLES,
    LEVELS,
    requestToken,
    PORT,
    logFile,
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
    settingsIntegrity,
    setup,
    checkForUpdates,
}