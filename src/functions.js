const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const electron = require('electron')
const child_process = require('child_process')
const createDesktopShortcut = require('create-desktop-shortcuts')
const dotenv = require("dotenv").config()
// const dialog = require('node-file-dialog')

/**
 * used to check a JSON object for integrity by comparing it with the JSON ```objectToCompare```
 * @param {JSON} objectToCheck the JSON object to compare the keys from with the ```objectToCompare```
 * @param {JSON} objectToCompare the JSON object with the only keys in the ```objectToCheck```
 * @returns true or false wether the JSON objects are equal or not
 */
function checkForIntegrity(objectToCheck, objectToCompare){
    const keys = Object.keys(objectToCheck)
    const neededKeys = Object.keys(objectToCompare)
    console.log("checkForIntegrity: given keys", keys, "needed keys", neededKeys)
    if(arraysEquaul(keys, neededKeys)) return true
    else return false
}
function arraysEquaul(a, b){
    if (a === b) return true
    if (a == null || b == null) return false
    if (a.length !== b.length) return false

    // If you don't care about the order of the elements inside
    // the array, you should sort both arrays here.
    // Please note that calling sort on an array will modify that array.
    // you might want to clone your array first.

    const aSorted = Array.from(a)
    const bSorted = Array.from(b)

    for (let i = 0; i < aSorted.length; ++i) {
        if (aSorted[i] !== bSorted[i]) return false
    }
    return true
}
/**
 * used to create a shortcut on the desktop
 * @param {string} name for the shortcut to show on the desktop
 * @param {string} filePath to the exe which will be executed when the shortcut is clicked
 * @param {string} icon path to the icon of the shortcut
 */
async function createShortcut(name, filePath, icon){
    try{
        // const shortcutsCreated = createDesktopShortcut({
        //     customLogger: function (message, error) {
        //         console.error("createShortcut: ", message, error);
        //     },
        //     onlyCurrentOS: true,
        //     verbose: true,
        //     windows: {
        //         filePath,
        //         name,
        //         comment: "Sketchy Games Launcher: " + name,
        //         icon
        //     }
        // })
        // if(shortcutsCreated){
        //     console.log("createShortcut: successfully")
        // }
        // else console.log("createShortcut: failed")
        const shortcutCmd = child_process.spawn("powershell", ["$s=(New-Object -COM WScript.Shell).CreateShortcut('%userprofile%\\Start Menu\\Programs\\Startup\\" + name + ".lnk');$s.TargetPath='" + filePath + "';$s.Save()"])

        shortcutCmd.on("spawn", () => {
            console.log("createShortcut: spawned cmd")
        })

        shortcutCmd.on("message", (message) => {
            console.log("createShortcut: message:", message)
        })

        shortcutCmd.on("error", (error) => {
            console.log("createShortcut: error:", error)
        })

        shortcutCmd.on("close", (code) => {
            console.log("createShortcut: close:", code)
        })
    }
    catch(err){
        console.error("createShortcut:", err)
    }
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
            new electron.Notification({
                title: "Sketchy Games Launcher",
                subtitle: title,
                body: message,
                icon: config.resources + "img/icon-scaled.png",
            }).addListener("click", function(e) {
                open()
            }).show()
        }
    }
    catch(err){
        console.error("sendNotification:", err)
        new electron.Notification({
            title: "Sketchy Games Launcher",
            subtitle: title,
            body: message + " Error: " + err.toString(),
            icon: config.resources + "img/icon.png",
        }).addListener("click", function(e) {
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
    electron.BrowserWindow.getAllWindows()[0].setMovable(true)
    electron.BrowserWindow.getAllWindows()[0].moveTop()
}
/**
 * used to ```close``` the current focused window
 */
function close(){
    sendNotification("Closed Launcher", "The launcher got closed.")
    electron.BrowserWindow.getAllWindows()[0].close()
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
 * @param {string} type defines what type of dialog should be opened
 * @returns {Promise} returns the selected objects, or an error if nothing was selected
 */
function showDialog(){
    return new Promise(async cb => {
        const selected = await electron.dialog.showOpenDialog({properties: ["openDirectory", "createDirectory"]})
        if(!selected.canceled) cb(selected.filePaths)
        else cb([])

        // let finalType
        // if(!type) finalType = "directory"
        // else finalType = type

        // dialog({type: finalType}).then((value) => {
        //     cb(value)
        // }).catch((reason) => {
        //     console.log("showDialog: could not get value from dialog for the reason:", reason)
        //     cb([])
        // })
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
    return new Promise(cb => {
        fs.copyFile(path, dest, (err) => {
            if(err){
                console.error(err)
                cb(err)
            }
            else cb()
        })
    })
}
/**
 * removes a file or directory at the given ```path```
 * @param {string} path ```path``` to file or directory to remove
 * @returns {Promise} returns nothing
 */
function remove(path){
    return new Promise(cb => {
        fs.rm(path, {recursive: true}, (err) => {
            if(err){
                console.error(err)
                cb(err)
            }
            else cb()
        })
    })
}
/** 
 * move a directory or file to the given ```path```
 * @param {string} path the directory or file to move to the ```dest```
 * @param {string} dest the new directory or file to move to.
 * @returns {Promise}
 */
function move(path, dest){
    return new Promise(cb => {
        fs.rename(path, dest, (err) => {
            if(err){
                console.error(err)
                cb(err)
            }
            else cb()
        })
    })
}
/**
 * reads a directory at the given ```path```
 * @param {string} path the directory to read the files from
 * @returns {Promise<Array<string>>} returns every file in the given directory
 */
function readDir(path){
    return new Promise(cb => {
        fs.readdir(path, (err, files) => {
            if(err){
                console.error(err)
                cb(err)
            }
            else cb(files)
        })
    })
}
/**
 * reads a file at the given ```path```
 * @param {string} path the file to read
 * @returns {Promise<string>} returns the content of the file in string format
 */
function read(path){
    return new Promise(cb => {
        fs.readFile(path, (err, data) => {
            if(err){
                console.error(err)
                cb(err)
            }
            else cb(data.toString())
        })
    })
}
/**
 * writes ```data``` into a file at the given ```path```
 * @param {string} path the path where the file should be created
 * @param {string} data the data in string format to write in the file
 * @returns {Promise}
 */
function write(path, data){
    return new Promise(cb => {
        fs.writeFile(path, data, (err) => {
            if(err){
                console.error(err)
                cb(err)
            }
            else cb()
        })
    })
}
/**
 * creates a directory at the given ```path```
 * @param {string} path the path to create the directory
 * @returns {Promise}
 */
function mkDir(path){
    return new Promise(cb => {
        fs.mkdir(path, (err) => {
            if(err){
                console.error(err)
                cb(err)
            }
            else cb()
        })
    })
}
/**
 * fetches a specific ```url``` with the ```GET``` method and returns the data of the response
 * @param {string} url the url to be fetched
 * @returns {Promise} the data of the response from the fetched url
 */
function get(url){
    return new Promise(async cb => {
        fetch(url).then((response) => response.json()).then((result) => {
            console.log("get:", url, "response:", result)
            cb(result.data)
        }).catch((err) => {
            console.error("get:", url, "error:", err)
            cb(err)
        })
    })
}
/**
 * fetches a specific ```url``` with the ```POST``` method with the preferred ```data``` as ```JSON``` and returns the data of the response
 * @param {string} url the url to be fetched
 * @param {JSON} data the data that needs to be send to the url
 * @returns {Promise} the data of the response from the fetched url
 */
function send(url, data){
    return new Promise(async cb => {
        fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}}).then((response) => response.json()).then((result) => {
            console.log("send:", url, "response:")
            console.dir(result, {depth: null})
            cb(result.data)
        }).catch((err) => {
            console.error("send:", url, "error:", err)
            cb(err)
        })
    })
}
const algorithm = "aes-256-ctr"
const key = crypto.createHash('sha256').update(dotenv.parsed.ENCRYPTION_KEY).digest("hex")
/**
 * used to encrypt ```data``` and return the result
 * @param {string | number | boolean | JSON} data the data that should be encrypted
 * @returns {string} the encrypted data
 */
function encrypt(data){
    let iv = crypto.randomBytes(16)
    let cipher = crypto.createCipheriv(algorithm, Buffer.from(key, "hex"), iv)
    let encrypted = cipher.update(data)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return iv.toString("hex") + ":" + encrypted.toString("hex")
}
/**
 * used to decrypt ```data``` and return the result
 * @param {string} data the data that should be decrypted
 * @returns {string} the decrypted data
 */
function decrypt(data){
    let dataParts = data.split(":")
    let iv = Buffer.from(dataParts.shift(), "hex")
    let encryptedData = Buffer.from(dataParts.join(":"), "hex")
    let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, "hex"), iv)
    let decrypted = decipher.update(encryptedData)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}
/**
 * check the connection between the client and the server api.sketch-company.de and the internet
 * @param {number | null} timeout the time after the check will be canceled
 * @returns {Promise<number>} the status of the internet connection and the server connection to api.sketch-company.de. 
 * Returns 2 if connected to internet and server, 1 if connected to internet but not the server and 0 if none so no internet or server connection is given
 */
function checkInternetConnection(timeout){
    return new Promise(cb => {
        try{
            if(!timeout) timeout = 3000
            fetch("https://api.sketch-company.de/status", {signal: AbortSignal.timeout(timeout)}).then(async (response) => {
                let json = await response.json()
                if(json.status == 1 && json.data == "connected"){
                    console.log("checkInternetConnection: connected")
                    cb(2) // connected to internet and sever
                } 
                else cb(1) // connected to internet but not server
    
            }).catch((err) => {
                console.log("checkInternetConnection: error on request:", err)
                cb(0) // not connected to internet and server
            })
        }
        catch(err){
            console.log("checkInternetConnection: error when starting request:", err)
            cb(0) // not connected to internet and server
        }
    })
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
    send,
    encrypt,
    decrypt,
    checkInternetConnection,
    minimize,
    close,
    sendNotification,
    createShortcut,
    showDialog,
    showMessageBox,
    showErrorBox,
    checkForIntegrity,
    redirect
}