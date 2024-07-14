const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const electron = require('electron')
const createDesktopShortcut = require('create-desktop-shortcuts');


async function createShortcut(name, filePath, icon){
    const shortcutsCreated = createDesktopShortcut({
        onlyCurrentOS: true,
        verbose: true,
        windows: {
            filePath,
            name,
            comment: "Sketchy Games Launcher: " + name,
            icon
        }
    })
    if(shortcutsCreated){
        console.log("createShortcut: successfully")
    }
    else console.log("createShortcut: failed")
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
        if(settings.notifications) {
            new electron.Notification({
                title: "Sketchy Games Launcher",
                subtitle: title,
                body: message,
                icon: config.resources + "img/icon-scaled.png",
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
        }).show()
    }    
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
 * @returns {null} returns nothing
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
 * @returns
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
 * @returns {Array<string>} returns every file in the given directory
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
 * @returns {string} returns the content of the file in string format
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
 * @returns 
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
 * @returns {null} returns nothing
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
 * @returns the data of the response from the fetched url
 */
function get(url){
    return new Promise(async cb => {
        const response = await fetch(url)
        const result = await response.json()
        console.log("get:", url, "response:", result)
        cb(result.data)
    })
}
/**
 * fetches a specific ```url``` with the ```POST``` method with the preferred ```data``` as ```JSON``` and returns the data of the response
 * @param {string} url the url to be fetched
 * @param {JSON} data the data that needs to be send to the url
 * @returns the data of the response from the fetched url
 */
function send(url, data){
    return new Promise(async cb => {
        const response = await fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}})
        const result = await response.json()
        console.log("send:", url, "response:")
        console.dir(result, {depth: null})
        cb(result.data)
    })
}
const algorithm = "aes-256-ctr"
const key = crypto.createHash('sha256').update("SketchyGamesLauncherEncryptionKey").digest("hex")
/**
 * used to encrypt ```data``` and return the result
 * @param {string | number | boolean | JSON} data the data that should be encrypted
 * @returns the encrypted data
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
 * @returns the decrypted data
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
function checkInternetConnectivity(){
    return new Promise(cb => {
        require('dns').lookup('google.com', function(err) {
            if(err){
                console.error("checkInternetConnectivity: lookup google.com", err)
                require('dns').lookup('sketch-company.de', function(err) {
                    if(err){
                        console.error("checkInternetConnectivity: lookup sketch-company.de", err)
                        cb(0)
                    }
                    else{
                        console.log("checkInternetConnectivity: lookup sketch-company.de connected")
                        cb(2)
                    }
                })
            }
            else{
                console.log("checkInternetConnectivity: lookup google.com connected")
                require('dns').lookup('sketch-company.de', function(err) {
                    if(err){
                        console.error("checkInternetConnectivity: lookup sketch-company.de", err)
                        cb(1)
                    }
                    else{
                        console.log("checkInternetConnectivity: lookup sketch-company.de connected")
                        cb(2)
                    }
                })
            }
        })
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
    checkInternetConnectivity,
    minimize,
    close,
    sendNotification,
    createShortcut
}