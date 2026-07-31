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
// In der lokalen Entwicklung läuft die API über http (SKETCHY_API_BASE=http://localhost:3500) —
// genau dieser eine http-Origin wird dann zusätzlich für img-src freigegeben, sonst nichts.
const { API_BASE } = require("./apiBase")
const imgSrc = "img-src 'self' data: https:" + (API_BASE.startsWith("http:") ? " " + new URL(API_BASE).origin : "")
const cspHeader = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    imgSrc,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
].join("; ")
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", cspHeader)
    res.setHeader("X-Content-Type-Options", "nosniff")
    next()
})

app.use("/api", api)

// Static assets of the built SPA (JS/CSS/fonts under /assets and /fonts).
app.use(express.static(config.dist))

// SPA fallback: every non-API, non-asset route is handled by React Router.
app.get("*", (req, res) => {
    if(req.path.startsWith("/api")) return res.status(404).end()
    const indexFile = path.join(config.dist, "index.html")
    if(fs.existsSync(indexFile)) return res.sendFile(indexFile)
    res.status(500).send("<h1>500</h1>Frontend build not found. Run `npm run build:renderer`.")
})

// start listening of the server — NUR auf dem Loopback-Interface (127.0.0.1), damit der lokale
// API-Server nicht aus dem LAN erreichbar ist (der UA-Token-Gate allein wäre kein ausreichender
// Schutz gegen andere Geräte im Netzwerk).
app.listen(config.PORT, "127.0.0.1", (err) => {
    if(err){
        console.error(err)
    }
    else{
        console.log("Server listening on 127.0.0.1:" + config.PORT + ". Available at http://localhost:" + config.PORT)
    }
})
