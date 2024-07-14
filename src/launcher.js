const fs = require("fs")
const path = require("path")
const app = require("express")()
const bodyParser = require("body-parser")
const api = require("./api")

app.use(bodyParser.json())
app.use("/api", api.router)

// configuration
const {
    PORT,
    base,
    resources
} = require("./launcherConfig")

// apis
app.get("/res", (req, res) => {
    res.sendFile(resources + req.query.f)
})

app.get("/store/:product", (req, res) => {
    res.sendFile(base + "store/product.html")
})

app.get("*", (req, res) => {
    try{
        if(fs.existsSync(base + req.path + "/index.html")) res.sendFile(base + req.path + "/index.html")
        else res.redirect("/error?m=The page you were looking for could not be found.")
    }
    catch(err){
        console.log(err)
        res.redirect("/error?m=We don't know what to do either.")
    }
})

// start listening of the server
app.listen(PORT, (err) => {
    if(err){
        console.error(err)
    }
    else{
        console.log("Server listening on port " + PORT + ". Available at http://localhost:" + PORT)
    }
})