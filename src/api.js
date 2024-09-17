const router = require("express").Router()
const bodyParser = require("body-parser")
const child_process = require("child_process")
const func = require("./functions")
const https = require("https")
const fs = require("fs")
const unzipper = require("unzipper")
// const nodemailer = require("nodemailer")
// const smtpTransport = require("nodemailer-smtp-transport")
const path = require("path")
const config = require("./launcherConfig")

router.use(bodyParser.json())

router.post("/settings/move", async (req, res) => {
    try{
        const installs = JSON.parse(await func.read(config.installsFile))

        if(installs.games.length > 0){
            for (let i = 0; i < installs.games.length; i++) {
                const element = installs.games[i];
                // check if the game was installed in the old installationPath and not anywhere else like a special location
                console.log(req.path, "oldInstallationPath", req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"), "installationPath", element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"))
                if(req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\") == element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\")){
                    console.log(req.path, "found game with the same installation path as the old one, so it has to be moved to the newInstallation path")
                    await func.move(path.dirname(element.start), req.body.newInstallationPath + "/" + element.name)
                    console.log(req.path, "successfully moved", element.name, "to", req.body.newInstallationPath + "/" + element.name)
                    element.start = req.body.newInstallationPath + "/" + element.name + "/" + element.name + config.appExt
                    element.installationPath = req.body.newInstallationPath
                }
            }
        }
        else{
            console.log(req.path, "there are no games installed to move")
        }

        if(installs.softwares.length > 0){
            for (let i = 0; i < installs.softwares.length; i++) {
                const element = installs.softwares[i];
                // check if the software was installed in the old installationPath and not anywhere else like a special location
                console.log(req.path, "oldInstallationPath", req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"), "installationPath", element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"))
                if(req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\") == element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\")){
                    console.log(req.path, "found software with the same installation path as the old one, so it has to be moved to the newInstallation path")
                    await func.move(path.dirname(element.start), req.body.newInstallationPath + "/" + element.name)
                    console.log(req.path, "successfully moved", element.name, "to", req.body.newInstallationPath + "/" + element.name)
                    element.start = req.body.newInstallationPath + "/" + element.name + "/" + element.name + config.appExt
                    element.installationPath = req.body.newInstallationPath
                }
            }
        }
        else{
            console.log(req.path, "there are no softwares installed to move")
        }

        // nochmal überlegen wann die datein verschoben werden sollen, am besten nach dem speichern der einstellungen

        await func.write(config.installsFile, JSON.stringify(installs, null, 3))

        res.json({
            status: 0,
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
    await func.write(config.updatesFile, JSON.stringify({updates: []}))
    res.json({
        status: 1,
        data: "cleaned updates file"
    })
})
router.get("/updates", async (req, res) => {
    const updates = JSON.parse(await func.read(config.updatesFile))
    res.json({
        status: 1,
        data: updates
    })
})

const notifications = []
router.get("/notifications", async (req, res) => {
    res.json({
        status: 1,
        data: notifications
    })
})
router.post("/notifications/add", async (req, res) => {
    notifications.push(req.body)
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
        const status = await func.checkInternetConnection()
        if(status == 2){
            const userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
            console.log("req.body", req.body)
            const newUserData = {user: req.body.user, email: req.body.email, password: req.body.password, id: userData.id}

            const updateRes = await func.send("https://api.sketch-company.de/u/update", newUserData)
            console.log(req.path, updateRes)

            userData.user = newUserData.user
            userData.email = newUserData.email
            userData.password = newUserData.password

            await func.write(config.userFile, func.encrypt(JSON.stringify(userData)))

            res.json({
                status: 1,
                data: "Änderungen gespeichert."
            })
        }
        else if(status == 1){
            res.json({
                status: 0,
                data: "Keine Verbindung zum Server."
            })
        }
        else res.json({
            status: 0,
            data: "Keine Internetverbindung."
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
        const status = await func.checkInternetConnection()
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
                data: {exists: false, data: "Um einen Account zu erstellen brauchst du eine Internet Verbindung."}
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
        const status = await func.checkInternetConnection()
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
            if(await func.checkInternetConnection() == 2){
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
        const status = await func.checkInternetConnection()
        if(status == 2){
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
let progress = 0
let downloadTime = {
    hours: 0,
    minutes: 0,
    seconds: 0,
}
let downloadSpeed = 0
let isDownloading = false
const downloadQueue = []  
router.post("/download", (req, res) => {
    try{
        downloadQueue.push(req.body)
        console.log(req.path, "pushed to downloadQueue", downloadQueue)
        if(!isDownloading) download()
        setTimeout(res.json({
            status: 1,
            data: downloadQueue
        }), 100)
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
            progress = 0
            downloadSpeed = 0
            downloadTime = {
                hours: 0,
                minutes: 0,
                seconds: 0,
            }
            const currentDownload = downloadQueue[0]
            console.log("download:", "started download for", currentDownload.name)
            https.get(currentDownload.downloadUrl, {sessionTimeout: 0, timeout: 0}, (response) => {
                currentDownloadResponse = response
                const downloadPath = config.downloads + currentDownload.name + config.packageExt
                const writeStream = fs.createWriteStream(downloadPath)
                currentDownloadWriteStream = writeStream
                
                response.pipe(writeStream)

                const totalBytes = parseInt(response.headers["content-length"], 10)
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
                    progress = percentage - 1
                    downloadSpeed = speed.toFixed(2)
                    if(progress == -1) progress = 0
                    console.log("download:", currentDownload.name, "progress",  progress + "%")
                    console.log("download:", currentDownload.name, "speed", downloadSpeed + " MB/s")
                    console.log("download:", currentDownload.name, "time left", downloadTime.hours + ":" + downloadTime.minutes + ":" + downloadTime.seconds)
                })

                writeStream.on("finish", async() => {
                    writeStream.close()
                    if(!currentDownloadResponse || !currentDownloadWriteStream) return
                    currentDownloadResponse = null
                    currentDownloadWriteStream = null
                    console.log("download:", "completed for", currentDownload.name)
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
                    progress = 100
                    await addToAccount(latestInfo)
                    downloadQueue.splice(0, 1)
                    console.log("download:", "removed from downloadQueue", downloadQueue)
                    downloadTime = {
                        hours: 0,
                        minutes: 0,
                        seconds: 0
                    }
                    downloadSpeed = 0
                    isDownloading = false

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
function addToAccount(product){
    return new Promise(async cb => {
        try{
            const status = await func.checkInternetConnection()
            if(status == 2){
                const userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
                const onlineUserData = await func.send("https://api.sketch-company.de/u/find", {id: userData.id})

                if(!onlineUserData.games){ // no games array
                    onlineUserData.games = "[]"
                }

                const games = JSON.parse(onlineUserData.games)
                const now = new Date()
                const newGame = {
                    product,
                    name: product.name,
                    file: product.name + ".zip",
                    img: product.name + ".png",
                    purchased: now.toLocaleString(),
                    lastDownload: now.toLocaleString(),
                }
                for(let i = 0; i < games.length; i++){
                    const element = games[i];
                    if(element.name === product.name){
                        console.log("addToAccount: game already purchased", product.name)
                        console.log("addToAccount: updating game data")
                        newGame.purchased = element.purchased
                        console.log("addToAccount: element.purchased", element.purchased)
                        games.splice(i, 1)
                    }
                }
                games.push(newGame)
                onlineUserData.games = JSON.stringify(games).toString()
                
                const updateResponse = await func.send("https://api.sketch-company.de/u/update", onlineUserData)
                console.log("addToAccount: successfully added game to account")
                cb()
            }
            else{
                cb()
            }
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
        progress = 0
        downloadTime = {
            hours: 0,
            minutes: 0,
            seconds: 0
        }
        downloadSpeed = 0
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
                percentage: progress,
                time: downloadTime,
                speed: downloadSpeed
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
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
let lastProgress = 0
router.get("/download/progress", (req, res) => {
    try{
        if(lastProgress == 99 && progress == 0){
            lastProgress = progress
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
            lastProgress = progress
            res.json({
                state: 1,
                data: {
                    percentage: progress,
                    time: downloadTime,
                    speed: downloadSpeed
                }
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
router.get("/download/progress/reset", (req, res) => {
    try{
        progress = 0
        downloadSpeed = 0
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
        res.sendFile(req.query.installationPath + req.params.name + "/" + config.imgFile)
    }
    catch(err){
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
module.exports = router