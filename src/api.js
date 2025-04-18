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

router.get("/store", async (req, res) => {
    try{
        let response = await func.getAndCache("https://api.sketch-company.de/store", 30)
        const userData = JSON.parse(func.decrypt(await func.read(config.userFile)))
        
        switch(userData.role){
            case config.ROLES.user:
                response.populars = response.populars.filter(                               game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.suggestions = response.suggestions.suggestions.filter( game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.bestofweek = response.suggestions.bestofweek.filter(   game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.games = response.suggestions.games.filter(             game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.softwares = response.suggestions.softwares.filter(     game => !game.level || game.level == config.LEVELS.user)
                response.games = response.games.filter(                                     game => !game.level || game.level == config.LEVELS.user)
                response.softwares = response.softwares.filter(                             game => !game.level || game.level == config.LEVELS.user)
                console.log(req.path, "filtered for user")
                break
            case config.ROLES.dev:
                response.populars = response.populars.filter(                               game => game.level <= config.LEVELS.dev)
                response.suggestions.suggestions = response.suggestions.suggestions.filter( game => game.level <= config.LEVELS.dev)
                response.suggestions.bestofweek = response.suggestions.bestofweek.filter(   game => game.level <= config.LEVELS.dev)
                response.suggestions.games = response.suggestions.games.filter(             game => game.level <= config.LEVELS.dev)
                response.suggestions.softwares = response.suggestions.softwares.filter(     game => game.level <= config.LEVELS.dev)
                response.games = response.games.filter(                                     game => game.level <= config.LEVELS.dev)
                response.softwares = response.softwares.filter(                             game => game.level <= config.LEVELS.dev)
                console.log(req.path, "filtered for dev")
                break
            case config.ROLES.admin: // just break because admin has full access
                break
            default:
                response.populars = response.populars.filter(                               game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.suggestions = response.suggestions.suggestions.filter( game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.bestofweek = response.suggestions.bestofweek.filter(   game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.games = response.suggestions.games.filter(             game => !game.level || game.level == config.LEVELS.user)
                response.suggestions.softwares = response.suggestions.softwares.filter(     game => !game.level || game.level == config.LEVELS.user)
                response.games = response.games.filter(                                     game => !game.level || game.level == config.LEVELS.user)
                response.softwares = response.softwares.filter(                             game => !game.level || game.level == config.LEVELS.user)
                console.log(req.path, "filtered for default (user)")
                break
        }
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
router.get("/request-and-cache", async (req, res) => {
    try{
        const url = req.query.url
        const response = await func.getAndCache(url, 30)
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

router.post("/browser", async (req, res) => {
    try{
        const openBrowser = await import("open")
        const asd = await openBrowser.default(req.body.url);
        asd.unref()
        console.log(req.path, "opened browser at " + req.body.url)
        res.json({
            status: 1,
            data: "opened browser"
        })
    }
    catch(err){
        res.json({
            status: 0,
            data: err.toString()
        })
    }
})

router.get("/patch-notes", async (req, res) => {
    try{
        const data = await func.getRepository()
        res.json({
            status: 1,
            data
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

router.get("/close-for-update", (req, res) => {
    try{
        console.log(req.path, "launcher was closed by another application (launcher):", req)
        setTimeout(() => func.close(), 10)
        res.json({
            status: 1,
            data: "closed"
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

router.post("/settings/move", async (req, res) => {
    try{
        const installs = JSON.parse(await func.read(config.installsFile))

        if(installs.games.length > 0){
            for (let i = 0; i < installs.games.length; i++) {
                const element = installs.games[i];
                // check if the game was installed in the old installationPath and not anywhere else like a special location
                if(!element.installationPath.endsWith("\\") && !element.installationPath.endsWith("/")) element.installationPath += "\\"
                if(!req.body.oldInstallationPath.endsWith("\\") && !req.body.oldInstallationPath.endsWith("/")) req.body.oldInstallationPath += "\\"
                console.log(req.path, "oldInstallationPath", req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"), "installationPath", element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"))
                if(req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\") == element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\")){
                    console.log(req.path, "found game with the same installation path as the old one, so it has to be moved to the newInstallation path", element)
                    await func.move(path.dirname(element.start), req.body.newInstallationPath + "/" + element.name)
                    console.log(req.path, "successfully moved", element.name, "to", req.body.newInstallationPath + "/" + element.name)
                    element.start = req.body.newInstallationPath + "/" + element.name + "/" + element.name + config.appExt
                    element.installationPath = req.body.newInstallationPath
                    if(!element.installationPath.endsWith("/") && !element.installationPath.endsWith("\\")) element.installationPath += "\\"
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
                if(!element.installationPath.endsWith("\\") && !element.installationPath.endsWith("/")) element.installationPath += "\\"
                if(!req.body.oldInstallationPath.endsWith("\\") && !req.body.oldInstallationPath.endsWith("/")) req.body.oldInstallationPath += "\\"
                console.log(req.path, "oldInstallationPath", req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"), "installationPath", element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\"))
                if(req.body.oldInstallationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\") == element.installationPath.replaceAll("/", "\\").replaceAll("\\\\", "\\").replaceAll("//", "\\")){
                    console.log(req.path, "found software with the same installation path as the old one, so it has to be moved to the newInstallation path", element)
                    await func.move(path.dirname(element.start), req.body.newInstallationPath + "/" + element.name)
                    console.log(req.path, "successfully moved", element.name, "to", req.body.newInstallationPath + "/" + element.name)
                    element.start = req.body.newInstallationPath + "/" + element.name + "/" + element.name + config.appExt
                    element.installationPath = req.body.newInstallationPath
                    if(!element.installationPath.endsWith("/") && !element.installationPath.endsWith("\\")) element.installationPath += "\\"
                }
            }
        }
        else{
            console.log(req.path, "there are no softwares installed to move")
        }

        // nochmal überlegen wann die datein verschoben werden sollen, am besten nach dem speichern der einstellungen

        await func.write(config.installsFile, JSON.stringify(installs, null, 3))

        res.json({
            status: 1,
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
    try{
        if(req.query.name){
            const updates = JSON.parse(await func.read(config.updatesFile)).updates
            for (let i = 0; i < updates.length; i++) {
                const element = updates[i];
                if(element.name == req.query.name){
                    updates.splice(i, 1)
                    await func.write(config.updatesFile, JSON.stringify({updates}, null, 3))
                    console.log(req.path, "deleted " + req.query.name + " from updates file")
                    break
                }
            }
            res.json({
                status: 1,
                data: "deleted " + req.query.name + " from updates file"
            })
        }
        else{
            await func.write(config.updatesFile, JSON.stringify({updates: []}, null, 3))
            res.json({
                status: 1,
                data: "cleaned updates file"
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
router.get("/updates/pull", async (req, res) => {
    try{

        const status = await func.checkInternetConnection()

        if(status == 2){
            const updates = []
            
            // read installed games
            const installs = JSON.parse(await func.read(config.installsFile))

            // get latest information from the store api
            const storeProducts = await func.get("https://api.sketch-company.de/store")

            // check installed games for updates
            if(installs.games.length > 0){
                for (let i = 0; i < installs.games.length; i++) {
                    const element = installs.games[i];
                    console.log(req.path, "checkForUpdates: checking", element.name)
                    for (let i2 = 0; i2 < storeProducts.games.length; i2++) {
                        const onlineElement = storeProducts.games[i2];
                        if(element.name == onlineElement.name && element.version != onlineElement.version){
                            console.log(req.path, "checkForUpdates: found update for", element.name)
                            console.log(req.path, "checkForUpdates: from", element.version, "to", onlineElement.version)
                            onlineElement.installationPath = element.installationPath
                            onlineElement.categorie = "games"
                            updates.push(onlineElement)
                            //console.log(req.path, "checkForUpdates: pushed to updatesFile", updates)
                        }
                    }
                }
            }
            else console.log(req.path, "checkForUpdates: no games installed to check")

            // check installed softwares for updates
            if(installs.softwares.length > 0){
                for (let i = 0; i < installs.softwares.length; i++) {
                    const element = installs.softwares[i];
                    console.log(req.path, "checkForUpdates: checking", element.name)
                    for (let i2 = 0; i2 < storeProducts.softwares.length; i2++) {
                        const onlineElement = storeProducts.softwares[i2];
                        if(element.name == onlineElement.name && element.version != onlineElement.version){
                            console.log(req.path, "checkForUpdates: found update for", element.name)
                            console.log(req.path, "checkForUpdates: from", element.version, "to", onlineElement.version)
                            onlineElement.installationPath = element.installationPath
                            onlineElement.categorie = "softwares"
                            updates.push(onlineElement)
                            //console.log(req.path, "checkForUpdates: pushed to updatesFile", updates)
                        }
                    }
                }
            }
            else console.log(req.path, "checkForUpdates: no softwares installed to check")

            if(updates.length > 0){
                await func.write(config.updatesFile, JSON.stringify({updates}, null, 3))
                console.log(req.path, "checkForUpdates: wrote updates to updatesFile")
            }
            else console.log(req.path, "checkForUpdates: no updates found")

            res.json({
                status: 1,
                data: updates
            })
        }
        else if(status == 1){
            res.json({
                status: 0,
                data: "Keine Verbindung zum Server."
            })
        }
        else{
            res.json({
                status: 0,
                data: "Keine Interneverbindung."
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
        await func.write(config.settingsFile, func.encrypt(JSON.stringify(req.body, null, 3)))
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

            const accountApproved = await func.send("https://api.sketch-company.de/u/proof", {id: userData.id, user: req.body.user, email: req.body.email})

            if(accountApproved){
                const newUserData = {user: req.body.user, email: req.body.email, password: func.encrypt(req.body.password), id: userData.id}

                const updateRes = await func.send("https://api.sketch-company.de/u/update", newUserData)
                console.log(req.path, updateRes)

                userData.user = newUserData.user
                userData.email = newUserData.email
                userData.password = newUserData.password

                await func.write(config.userFile, func.encrypt(JSON.stringify(userData, null, 3)))

                res.json({
                    status: 1,
                    data: "Änderungen gespeichert."
                })
            }
            else{
                res.json({
                    status: 0,
                    data: "Ein Benutzer mit diesen Daten existiert bereits. Ändere sie und versuch es nochmal."
                })
            }
            
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
            req.body.password = func.encrypt(req.body.password)
            const response = await func.send("https://api.sketch-company.de/u/signup", req.body)
            if(!response.exists){
                await func.write(config.userFile, func.encrypt(JSON.stringify(response.data, null, 3)))
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
            req.body.password = func.encrypt(req.body.password)
            const response = await func.send("https://api.sketch-company.de/u/login", req.body)
            if(response.correct){
                await func.write(config.userFile, func.encrypt(JSON.stringify(response.data, null, 3)))
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
            if(userData.user == req.body.userOrEmail && func.decrypt(userData.password) == req.body.password || userData.email == req.body.userOrEmail && func.decrypt(userData.password) == req.body.password){
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
                const response = await func.send("https://api.sketch-company.de/u/find", {id: userData.id}, true)
                await func.write(config.userFile, func.encrypt(JSON.stringify(response, null, 3)))
                delete response.password // delete password before sending data to frontend for security reasons
                if(response && typeof response == "object"){
                    res.json({
                        status: 1,
                        data: response
                    })
                }
                else res.json({
                    status: 0,
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
let downloadProgress = 0
let downloadTime = {
    hours: 0,
    minutes: 0,
    seconds: 0,
}
let downloadSpeed = 0
let downloadSize = 0
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
        console.error(req.path, err)
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
            downloadProgress = 0
            downloadSpeed = 0
            downloadSize = 0
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
                downloadSize = totalBytes
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
                    downloadProgress = percentage - 1
                    downloadSpeed = speed.toFixed(2)
                    if(downloadProgress == -1) downloadProgress = 0
                    console.log("download:", currentDownload.name, "progress",  downloadProgress + "%")
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
                    downloadProgress = 100
                    await addToAccount(latestInfo)
                    downloadQueue.splice(0, 1)
                    console.log("download:", "removed from downloadQueue", downloadQueue)
                    downloadTime = {
                        hours: 0,
                        minutes: 0,
                        seconds: 0
                    }
                    downloadSpeed = 0
                    downloadSize = 0
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
        product.size = await getDirectorySize(destination)
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
async function getDirectorySize(path){
    let size = 0
    const files = await func.readDir(path)
    for (let i = 0; i < files.length; i++) {
        const element = files[i];
        const filePath = path + "/" + element
        const stats = fs.statSync(filePath)
        if(stats.isFile()) size += stats.size
        else if(stats.isDirectory()) size += await getDirectorySize(filePath)
    }
    return size
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

                if(!onlineUserData.games) onlineUserData.games = "[]"

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
        downloadProgress = 0
        downloadSize = 0
        downloadSpeed = 0
        downloadTime = {
            hours: 0,
            minutes: 0,
            seconds: 0
        }
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
                percentage: downloadProgress,
                time: downloadTime,
                speed: downloadSpeed
            }
        })
    }
    catch(err){
        console.error(req.path, err)
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
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
let lastDownloadProgress = 0
router.get("/download/progress", (req, res) => {
    try{
        if(lastDownloadProgress == 99 && downloadProgress == 0){
            lastDownloadProgress = downloadProgress
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
            lastDownloadProgress = downloadProgress
            res.json({
                state: 1,
                data: {
                    percentage: downloadProgress,
                    time: downloadTime,
                    speed: downloadSpeed
                }
            })
        }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/download/progress/reset", (req, res) => {
    try{
        downloadProgress = 0
        downloadSpeed = 0
        downloadSize = 0
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
        console.error(req.path, err)
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
                    progress: downloadProgress
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
        console.error(req.path, err)
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
        console.error(req.path, err)
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
        console.error(req.path, err)
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
        console.error(req.path, err)
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
        console.error(req.path, err)
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
        console.error(req.path, err)
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
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
router.get("/library/add", async (req, res) => {
    try{
        const filePath = (await func.showDialog(["openFile"]))[0]
        const folderPath = path.dirname(filePath)

        console.log(req.path, "filePath", filePath)

        const fileName = path.parse(filePath).name

        console.log(req.path, "fileName", fileName)

        const storeRes = await func.get("https://api.sketch-company.de/store")

        const isGame = storeRes.games.some(game => game.name == fileName)

        console.log(req.path, "isGame", isGame)

        const isSoftware = storeRes.softwares.some(game => game.name == fileName)

        console.log(req.path, "isSoftware", isSoftware)

        let product = null

        if(isGame){
            console.log(req.path, "product to add is a game", fileName)

            product = storeRes.games.find(game => game.name == fileName)

            console.log(req.path, "product", product)

            product.categorie = "games"
            product.size = await getDirectorySize(folderPath)
            product.installationPath = path.dirname(folderPath) + "\\"
            product.start = filePath
            product.patchNotes = getPatchNotes(product.patchNotes, 5)

            console.log(req.path, "end result of product", product)
        }
        else if(isSoftware){
            console.log(req.path, "product to add is a software", fileName)

            product = storeRes.softwares.find(software => software.name == fileName)

            console.log(req.path, "product", product)

            product.categorie = "softwares"
            product.size = await getDirectorySize(folderPath)
            product.installationPath = folderPath
            product.start = filePath
            product.patchNotes = getPatchNotes(product.patchNotes, 5)

            console.log(req.path, "end result of product", product)
        }
        else{
            console.warn(req.path, "the file is not supported by the Sketchy Games Launcher")
            await func.showErrorBox("Not supported", "The file is not supported by the Sketchy Games Launcher")
        }

        // write to installsFile
        const installs = JSON.parse(await func.read(config.installsFile))
        if(product.categorie == "games"){
            if(!installs.games.some(element => element.name == product.name)){
                installs.games.push(product)

                await func.write(config.installsFile, JSON.stringify(installs))
                console.log(req.path, "product added to installsFile and is tracked now in", config.installsFile)
            }
            else{
                console.error(req.path, "game is already tracked in the installsFile under games")
            }
        }
        else if(product.categorie == "softwares"){
            if(!installs.softwares.some(element => element.name == product.name)){
                installs.softwares.push(product)

                await func.write(config.installsFile, JSON.stringify(installs))
                console.log(req.path, "product added to installsFile and is tracked now in", config.installsFile)
            }
            else{
                console.error(req.path, "game is already tracked in the installsFile under softwares")
            }
        }
        

        res.json({
            status: 1,
            data: product
        })

        // const folderPath = (await func.showDialog())[0] + "/"

        // console.log(req.path, "folderPath:", folderPath)

        // const folderContent = await func.readDir(folderPath)

        // console.log(req.path, "folderContent:", folderContent)
        
        // // check if folder contains an executable file to symbolize a "game" or "program" there are always more files that are important
        // // to run the program but its a first simple check
        // if(folderContent.some(file => file.endsWith(".exe"))){
        //     const storeRes = await func.get("https://api.sketch-company.de/store")
        //     const exeFilesInFolder = folderContent.filter(file => file.endsWith(".exe"))
        //     exeFilesInFolder.splice(exeFilesInFolder.indexOf("UnityCrashHandler64.exe"), 1)

        //     console.log(req.path, "exeFilesInFolder:", exeFilesInFolder)

        //     let newProduct = null

        //     if(exeFilesInFolder.filter(file => storeRes.games.some(element => element.name == path.basename(folderPath + file)))){
        //         const file = folderPath + exeFilesInFolder.filter(file => storeRes.games.some(element => element.name == path.basename(folderPath + file)))[0]

        //         if(file){
        //             console.log(req.path, "file:", file)

        //             const productName = path.basename(file)

        //             console.log(req.path, "productName:", productName)

        //             newProduct = storeRes.games[productName]
        //             newProduct.categorie = "games"
        //             newProduct.size = await getDirectorySize(folderPath)
        //             newProduct.installationPath = folderPath
        //             newProduct.start = folderPath + "/" + productName + ".exe"
        //             newProduct.patchNotes = getPatchNotes(newProduct.patchNotes, 5)
        //         }
        //         else console.warn(req.path, "there is no game in this folder, that the Sketchy Games Launcher supports")                
        //     }
        //     else if(exeFilesInFolder.filter(file => storeRes.softwares.some(element => element.name == path.basename(folderPath + file)))){
        //         const file = folderPath + exeFilesInFolder.filter(file => storeRes.softwares.some(element => element.name == path.basename(folderPath + file)))[0]

        //         if(file){
        //             console.log(req.path, "file:", file)

        //             const productName = path.basename(file)

        //             console.log(req.path, "productName:", productName)

        //             newProduct = storeRes.softwares[productName]
        //             newProduct.categorie = "softwares"
        //             newProduct.size = await getDirectorySize(folderPath)
        //             newProduct.installationPath = folderPath
        //             newProduct.start = folderPath + "/" + productName + ".exe"
        //             newProduct.patchNotes = getPatchNotes(newProduct.patchNotes, 5)
        //         }
        //         else console.warn(req.path, "there is no software in this folder, that the Sketchy Games Launcher supports")                
        //     }
        //     else{
        //         const errorRes = await func.showErrorBox("Invalid product", "The product to add cannot be found in our available products. This game is not compatible with the Sketchy Games Launcher.")
        //     }

        //     console.log(req.path, "newProduct:", newProduct)
        //     res.json({
        //         status: 1,
        //         data: newProduct
        //     })
        // }
        // else{
        //     const errorRes = await func.showErrorBox("No executable was found", "There is no .exe file in this folder. You need to ad valid folder with an .exe file to be run as \"game\" or \"program\"")
        // }
    }
    catch(err){
        console.error(req.path, err)
        res.json({
            state: 0,
            data: err.toString()
        })
    }
})
function getPatchNotes(notes, depth){
    let result = ""
    for (let i = 0; i < depth; i++) {
        const element = notes[i]
        if(!element) continue
        result += element.version
        result += "<br>"
        result += element.notes.replaceAll("\n", "<br>")
        result += "<br><br>"
    }
    return result
}
module.exports = router