const fs = require("fs")
const path = require("path")
const express = require("express")
const app = express()
const bodyParser = require("body-parser")
const api = require("./api")
const config = require("./launcherConfig")

app.use(bodyParser.json())

// Only the Electron window (whose User-Agent ends with the request token) may talk
// to this local server. External browsers are rejected.
app.use((req, res, next) => {
    const ua = req.get("User-Agent") || ""
    if(ua.endsWith(config.requestToken)){
        return next()
    }
    res.status(400).send("<h1>400 Bad Request</h1>Sketchy Games Launcher can only be accessed in the app.<br>Please open the Sketchy Games Launcher app.")
    res.end()
})

// Content-Security-Policy for the served SPA. The Vite production build emits only
// external (self-hosted) scripts/styles/fonts, so we can keep this tight. Remote
// https images are allowed for store cover art served from api.sketch-company.de.
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
    ].join("; "))
    res.setHeader("X-Content-Type-Options", "nosniff")
    next()
})

app.use("/api", api)

// Server-side resources (cover images downloaded by the launcher, icons, etc.).
app.get("/res", (req, res) => {
    res.sendFile(config.resources + req.query.f)
})

// Static assets of the built SPA (JS/CSS/fonts under /assets and /fonts).
app.use(express.static(config.dist))

// SPA fallback: every non-API, non-asset route is handled by React Router.
app.get("*", (req, res) => {
    if(req.path.startsWith("/api")) return res.status(404).end()
    const indexFile = path.join(config.dist, "index.html")
    if(fs.existsSync(indexFile)) return res.sendFile(indexFile)
    res.status(500).send("<h1>500</h1>Frontend build not found. Run `npm run build:renderer`.")
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
