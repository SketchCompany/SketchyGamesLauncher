const router = require("express").Router()
const bodyParser = require("body-parser")
const child_process = require("child_process")
const func = require("./functions")
const https = require("https")
const fs = require("fs")
const unzipper = require("unzipper")
const nodemailer = require("nodemailer")
const smtpTransport = require("nodemailer-smtp-transport")
const path = require("path")
const config = require("./launcherConfig")
const cheerio = require("cheerio")
const electron = require("electron")

router.use(bodyParser.json())

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
        await func.write(config.settingsFile, func.encrypt(JSON.stringify(req.body)))
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
        const settings = JSON.parse(func.decrypt(await func.read(config.settingsFile)))
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
router.get("/account/logout", async (req, res) => {
    try{
        await func.remove(config.userFile)
        res.json({
            status: 1,
            data: "User File wurde entfernt"
        })
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            status: 0,
            data: err.toString()
        })
    }})
router.post("/account/signup", async (req, res) => {
    try{
        const status = await func.checkInternetConnectivity()
        if(status == 2){
            const response = await func.send("https://api.sketch-company.de/u/signup", req.body)
            if(!response.exists){
                await func.write(config.userFile, func.encrypt(JSON.stringify(response.data)))
                res.json({
                    status: 1,
                    data: {exists: false, data: response}
                })
            }
            else{
                console.error(req.path, "user with this data already exists", req.body)
                res.json({
                    status: 1,
                    data: {exists: true, data: "Ein Nutzer mit diesen Daten exestiert bereits. Bitter ändere den Benutzernamen oder die Email und probiers nochmal."}
                })
            }
        }
        else if(status == 1){
            console.error(req.path, "could not connect to sketch-company.de servers")
            res.json({
                status: 0,
                data: {exists: false, data: "Sorry! Unsere Server sind möglicherweise offline, aufgrund von Wartungsarbeiten oder anderen Probleme. Probiers später nochmal."}
            })
        }
        else if(status == 0){
            res.json({
                status: 0,
                data: {exists: false, data: "Um einen Accoun zu erstellen brauchst du eine Internet Verbindung."}
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
router.post("/account/login", async (req, res) => {
    try{
        const status = await func.checkInternetConnectivity()
        if(status == 2){
            const response = await func.send("https://api.sketch-company.de/u/login", req.body)
            if(response.correct){
                await func.write(config.userFile, func.encrypt(JSON.stringify(response.data)))
                console.log(req.path, "successfully logged in as", response.data.user)
                res.json({
                    status: 1,
                    data: {correct: true, data: response.data}
                })
            }
            else{
                console.error(req.path, "login data was not correct", response)
                res.json({
                    status: 1,
                    data: {correct: false, data: "Deine Anmeldedaten sind falsch. Überprüfe deine Daten und probiers nochmal. Fehlermeldung: " + JSON.stringify(response)}
                })
            }
        }
        else if(status == 1){
            console.error(req.path, "could not connect to sketch-company.de servers")
            res.json({
                status: 0,
                data: {exists: false, data: "Sorry! Unsere Server sind möglicherweise offline, aufgrund von Wartungsarbeiten oder anderen Probleme. Probiers später nochmal."}
            })
        }
        else if(status == 0 && func.exists(config.userFile)){
            const userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
            if(userData.user == req.body.userOrEmail && userData.password == req.body.password || userData.email == req.body.userOrEmail && userData.password == req.body.password){
                console.log(req.path, "successfully logged in as", userData.user)
                res.json({
                    status: 1,
                    data: {correct: true, data: userData}
                })
            }
            else{
                console.error(req.path, "login data was not correct", req.body)
                res.json({
                    status: 1,
                    data: {correct: false, data: "Deine Anmeldedaten sind falsch. Überprüfe deine Daten und probiers nochmal."}
                })
            }
        }
        else{
            console.error(req.path, "could not login, because of no internet connection")
            res.json({
                status: 0,
                data: {correct: false, data: "Um dich einzuloggen brauchst du eine Internet Verbindung"}
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
router.get("/account", async (req, res) => {
    try{
        if(func.exists(config.userFile)){
            const userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
            if(await func.checkInternetConnectivity() == 2){
                const response = await func.send("https://api.sketch-company.de/u/find", {id: userData.id})
                await func.write(config.userFile, func.encrypt(JSON.stringify(response)))
                res.json({
                    status: 1,
                    data: response
                })
            }
            else{
                res.json({
                    status: 1,
                    data: userData
                })
            }        
        }
        else{
            res.json({
                status: 0,
                data: "Die Nutzerdaten konnten nicht gefunden werden."
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
router.post("/connection", async (req, res) => {
    try{
        const status = await func.checkInternetConnectivity()
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
        const filepath = req.body.filepath
        if(func.exists(filepath)){
            const program = child_process.spawn(filepath, {detached: true, cwd: path.dirname(filepath)})
            program.on("spawn", async function(){
                const installs = JSON.parse(await func.read(config.installsFile))
                for (let i = 0; i < installs.games.length; i++) {
                    const element = installs.games[i];
                    if(element.name == req.body.name){
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
                    if(element.name == req.body.name){
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

router.post("/games/open", (req, res) => {
    try{
        const filepath = path.dirname(req.body.filepath)
        if(func.exists(filepath)){
            const program = child_process.exec("start \"\" \"" + filepath + "\"", {detached: true})
            program.on("error", function(err){
                console.error(req.path, "ERROR:", err)
            })
            program.on("close", function(code){
                console.log(req.path, "closed program with code", code)
            })
            res.json({
                status: 1,
                data: "Öffne Explorer bei " + filepath + "."
            })
            console.log(req.path, "opened folder in explorer at", filepath)
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
            body: err.toString()
        })
    }
})

router.post("/games/delete", async (req, res) => {
    try{
        const filepath = req.body.filepath
        if(func.exists(path.dirname(filepath))){
            await func.remove(path.dirname(filepath))
            const installs = JSON.parse(await func.read(config.installsFile))
            for (let i = 0; i < installs.games.length; i++) {
                const element = installs.games[i]
                if(element.name == req.body.name){
                    installs.games.splice(i, 1)
                    break
                }
            }
            for (let i = 0; i < installs.softwares.length; i++) {
                const element = installs.softwares[i]
                if(element.name == req.body.name){
                    installs.softwares.splice(i, 1)
                    break
                }
            }
            if(installs.other[0] && installs.other[0].name == req.body.name){
                installs.other.splice(0, 1)
            }
            await func.write(config.installsFile, JSON.stringify(installs, null, 3))
            res.json({
                status: 1,
                data: "Entferne " + req.body.name + "."
            })
            console.log(req.path, "deleted", filepath)
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
router.post("/email", async (req, res) => {
    try{
        //req.body.from = "Sketchy Games Launcher"
        if(!req.body.user && !req.body.email && func.exists(config.userFile)){
            const userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
            if(!req.body.user) req.body.user = userData.user
            if(!req.body.email) req.body.email = userData.email
        }
        const response = await func.send("https://api.sketch-company.de/email", req.body)
        res.json({
            status: 1,
            data: response
        })
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
let progress = 0
let isDownloading = false
const downloadQueue = []  
router.post("/download", (req, res) => {
    try{
        downloadQueue.push(req.body)
        console.log(req.path, "pushed to downloadQueue", downloadQueue)
        if(!isDownloading) download()
        res.json({
            status: 1,
            data: downloadQueue
        })
    }
    catch(err){
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
let currentDownloadResponse
let currentDownloadWriteStream
function download(){
    try{
        if(downloadQueue.length > 0 && !isDownloading){
            const currentDownload = downloadQueue[0]
            console.log("download:", "started download for", currentDownload.name)
            https.get(currentDownload.downloadUrl, (response) => {
                isDownloading = true
                currentDownloadResponse = response
                const downloadPath = config.downloads + currentDownload.name + config.packageExt
                const writeStream = fs.createWriteStream(downloadPath)
                currentDownloadWriteStream = writeStream
                response.pipe(writeStream)
                writeStream.on("drain", () => {
                    progress = (Math.round(writeStream.bytesWritten / (parseInt(response.headers['content-length'], 10)) * 100)) -1
                    if(progress == -1) progress = 0
                    console.log("download:", "progress", currentDownload.name, progress.toString() + "%")
                })
                writeStream.on("finish", async() => {
                    writeStream.close()
                    if(!currentDownloadResponse || !currentDownloadWriteStream) return
                    currentDownloadResponse = null
                    currentDownloadWriteStream = null
                    console.log("download:", "completed for", currentDownload.name)
                    const latestInfo = await unpackage(currentDownload, downloadPath, config.installs + currentDownload.name + "/")
                    progress = 100
                    if(!currentDownload.isLauncher){
                        await downloadImage(currentDownload)
                        func.createShortcut(latestInfo.name, latestInfo.start, latestInfo.start)
                    } 
                    downloadQueue.splice(0, 1)
                    console.log("download:", "removed from downloadQueue", downloadQueue)
                    progress = 0
                    isDownloading = false
                    if(currentDownload.isLauncher){
                        console.log("download: isLauncher", currentDownload.isLauncher)
                        const oldPath = path.dirname(latestInfo.start)
                        const newPath =  path.dirname(__dirname) + "/" + path.basename(path.dirname(latestInfo.start)) + " " + currentDownload.version
                        console.log("download: moving", oldPath, "to", newPath)
                        await func.move(oldPath, newPath)
                        const restart = child_process.spawn(newPath + "/Sketchy Games Launcher.exe", {detached: true, cwd: newPath})
                        restart.on("spawn", function(){
                            electron.BrowserWindow.getAllWindows()[0].close()
                            process.exit()
                        })
                    }
                    if(downloadQueue.length > 0 && !isDownloading){
                        download()
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
async function unpackage(product, path, destination){
    console.log("unpackage:", "started unpacking for", product.name)
    return new Promise(async cb => {
        const directory = await unzipper.Open.file(path)
        await directory.extract({ path: destination })
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
        await func.remove(path)
        cb(product)
    })
}
async function downloadImage(product){
    console.log("downloadImage: started for", product.resourcesUrl + "1.png")
    return new Promise(cb => {
        https.get(product.resourcesUrl + "1.png", (response) => {
            const writeStream = fs.createWriteStream(config.installs + product.name + "/" + config.imgFile)
            response.pipe(writeStream)
            writeStream.on("finish", function(){
                writeStream.close()
                console.log("downloadImage: finished for", product.resourcesUrl + "1.png")
                cb()
            })
        })
    })
}
// async function downloadIcon(product){
//     console.log("downloadIcon: started for", product.resourcesUrl + "icon.ico")
//     return new Promise(cb => {
//         https.get(product.resourcesUrl + "icon.ico", (response) => {
//             const writeStream = fs.createWriteStream(config.installs + product.name + "/" + config.iconFile)
//             response.pipe(writeStream)
//             writeStream.on("finish", function(){
//                 writeStream.close()
//                 console.log("downloadIcon: finished for", product.resourcesUrl + "icon.ico")
//                 cb()
//             })
//         })
//     })
// }
router.get("/download/cancel", async (req, res) => {
    try{
        console.log("download:", "canceled")
        currentDownloadResponse.destroy()
        currentDownloadWriteStream.destroy()
        currentDownloadResponse = null
        currentDownloadWriteStream = null
        progress = 0
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
                progress
            }
        })
    }
    catch(err){
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/download/state", (req, res) => {
    try{
        let paused = false
        if(currentDownloadResponse.isPaused()) paused = true
        else paused = false
        res.json({
            state: 1,
            data: paused
        })
    }
    catch(err){
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/download/progress", (req, res) => {
    try{
        res.json({
            state: 1,
            data: {
                progress
            }
        })
    }
    catch(err){
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
                    progress
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
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.post("/downloads/unqueue", (req, res) => {
    try{
        downloadQueue.splice(req.body.index, 1)
        res.json({
            state: 1,
            data: downloadQueue
        })
    }
    catch(err){
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.post("/downloads/move", (req, res) => {
    try{
        downloadQueue.splice(req.body.to, 0, downloadQueue.splice(req.body.index, 1)[0])
        res.json({
            state: 1,
            data: downloadQueue
        })
    }
    catch(err){
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
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/library/img/:name", async (req, res) => {
    try{
        res.sendFile(config.installs + req.params.name + "/" + config.imgFile)
    }
    catch(err){
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
module.exports = {
    router, 
    download, 
    isDownloading, 
    downloadQueue
}