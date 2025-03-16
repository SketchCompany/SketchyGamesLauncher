const fs = require("fs")
const path = require("path")
const app = require("express")()
const bodyParser = require("body-parser")
const api = require("./api")
const config = require("./launcherConfig")

app.use(bodyParser.json())
app.use((req, res, next) => {
    if(req.get("User-Agent").endsWith(config.requestToken)){
        return next()
    }
    res.status(400).send("<h1>400 Bad Request</h1>Sketchy Games Launcher can only be accessed in the app.<br>Please open the Sketchy Games Launcher app.")
    res.end()
})
app.use("/api", api)

// apis
app.get("/res", (req, res) => {
    res.sendFile(config.resources + req.query.f)
})

app.get("/store/:product", (req, res) => {
    res.sendFile(config.base + "store/product.html")
})

app.get("*", (req, res) => {
    try{
        if(fs.existsSync(config.base + req.path + "/index.html")) res.sendFile(config.base + req.path + "/index.html")
        else res.redirect("/error?m=The page you were looking for could not be found.")
    }
    catch(err){
        console.log(err)
        res.redirect("/error?m=We don't know what to do either.")
    }
})

// start listening of the server
app.listen(config.PORT, (err) => {
    if(err){
        console.error(err)
    }
    else{
        console.log("Server listening on port " + config.PORT + ". Available at http://localhost:" + config.PORT)
    }
})