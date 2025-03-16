const { app, BrowserWindow, autoUpdater } = require("electron")
const config = require("./launcherConfig")
const func = require("./functions")
const path = require("path")

require("source-map-support").install()
const log = require("electron-log")
log.transports.file.level = "debug"
log.transports.file.resolvePathFn = (variables) => {
    return config.logFile
}
Object.assign(console, log.functions)
process.on("uncaughtException", (error) => {
    console.error("Unhandled Exception:", error)
})

function checkIfLauncherIsAlreadyOpen(){
    return new Promise(async cb => {
        try{
            const response = await fetch("http://localhost:" + config.PORT + "/api/close-for-update", {headers: {"User-Agent": config.requestToken}})
            config.PORT = 1521
            console.log("checkIfLauncherIsAlreadyOpen:", response)
            cb(response)
        }
        catch(err){
            console.log("checkIfLauncherIsAlreadyOpen: could not request so launcher is already closed")
            config.PORT = 1520
            cb(err)
        }
    })
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit()
}

const createWindow = async () => {
    // check if launcher is already open before initializing the backend server for the launcher
    await checkIfLauncherIsAlreadyOpen()
    require("./launcher")

    // check for updates and react with a message if there is an update available
    autoUpdater.on("update-available", async function(){
        const response = await func.showMessageBox("Update Available", "There is an Update for the launcher available. It is currently being downloaded, please do not close the launcher until you are offered to restart it.", [], "info")
    })
    require("update-electron-app").updateElectronApp({updateInterval: "5 minutes"})
    
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minHeight: 720,
        minWidth: 1280,
        maxWidth: 1920,
        autoHideMenuBar: true,
        icon: config.resources + "img/icon.png",
        title: "Sketchy Games Launcher",
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "rgb(30,30,35)",
            symbolColor: "springgreen",
            height: 25,
        },
    })

    // set cookie and make sure only electron can access the express app
    mainWindow.webContents.setUserAgent(mainWindow.webContents.getUserAgent() + config.requestToken)

    // first load the loading page
    mainWindow.loadURL("http://localhost:" + config.PORT + "/loading")

    // setup paths and files for usage
    await config.setup()
    
    // and load the index.html of the app.
    let settings = config.settingsIntegrity
    try{
        settings = JSON.parse(func.decrypt(await func.read(config.settingsFile)))
    }
    catch(err){
        console.error("createWindow: settings failed to read, decrypt and parse to JSON, using the settingsIntegrity object:", err)
    }
    let userData
    try{
        userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
    }
    catch(err){
        console.error("createWindow: userData failed to read, decrypt and parse to JSON, user has to login before using the launcher:", err)
    }
    if(!settings.loginOnStartup && userData.user && userData.email && userData.password){
        mainWindow.loadURL("http://localhost:" + config.PORT)
    }
    else mainWindow.loadURL("http://localhost:" + config.PORT + "/login")

    // Open the DevTools.
    !app.isPackaged || settings.console ? mainWindow.webContents.openDevTools() : console.log("createWindow: blocked dev tools from opening")
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
