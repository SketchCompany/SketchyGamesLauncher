const { app, BrowserWindow } = require('electron')
const config = require("./launcherConfig")
const func = require("./functions")
const path = require("path")
const log = require("electron-log/main")

log.transports.file.resolvePathFn = (variables) => {
    return path.join(path.parse(app.getPath("exe")).dir, variables.fileName)
}
Object.assign(console, log.functions)

function checkIfLauncherIsAlreadyOpen(){
    return new Promise(async cb => {
        try{
            const response = await fetch("http://localhost:" + config.PORT + "/api/close-for-update", {headers: {"User-Agent": config.requestToken}})
            config.PORT = 1521
            console.log("checkIfLauncherIsAlreadyOpen:", response)
            cb(response)
        }
        catch(err){
            console.log("checkIfLauncherIsAlreadyOpen: could not request, launcher is already closed")
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
    await checkIfLauncherIsAlreadyOpen()
    const launcher = require("./launcher")

    // check for updates
    require("update-electron-app").updateElectronApp()

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
            color: "rgb(30,30,30)",
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
    const settings = JSON.parse(func.decrypt(await func.read(config.settingsFile)))
    const userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
    if(!settings.loginOnStartup && userData.user && userData.email && userData.password){
        mainWindow.loadURL("http://localhost:" + config.PORT)
    }
    else mainWindow.loadURL("http://localhost:" + config.PORT + "/login")

    // Open the DevTools.
    !app.isPackaged || settings.console ? mainWindow.webContents.openDevTools() : console.log("blocked dev tools from opening")
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
