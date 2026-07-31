// Zentrale API-Konfiguration des Launchers. Früher stand die Basis-URL als String-Literal
// überall im Code — jetzt gibt es genau EINE Quelle. Alle Aufrufe der zentralen API laufen
// über API_BASE + einen Pfad unter /v1 (siehe V1-MIGRATION.md der API).
//
// Der Launcher hat kein Turnstile-Widget; er umgeht die Bot-Prüfung der Auth-Routen über den
// geteilten Geheimschlüssel LAUNCHER_KEY (Header X-Launcher-Key == env LAUNCHER_SHARED_SECRET
// der API). Lockout + Rate-Limit greifen serverseitig weiter.

// Runtime-Env laden (der Main-Prozess lädt .env sonst nicht — nur der Build tut das über
// config/secrets.js). In der Entwicklung liefert das die SKETCHY_*-Variablen aus der Root-.env.
// In gepackten Builds muss SKETCHY_LAUNCHER_KEY zur Build-/Laufzeit gesetzt sein.
try { require("dotenv").config() } catch (e) { /* dotenv optional in gepackten Builds */ }

// Überschreibbar für lokale Entwicklung (z.B. SKETCHY_API_BASE=http://localhost:3500).
// Die Spiel-Builds gehören jetzt der API: Katalog (/v1/launcher/builds), signierte Download-URL
// (/v1/store/:id/download-url) und die öffentliche Auslieferung (/builds/...) laufen alle über
// API_BASE. Es gibt keinen separaten Web-Host für Builds mehr.
const API_BASE = (process.env.SKETCHY_API_BASE || "https://api.sketch-company.de").replace(/\/+$/, "")

// Geteilter Launcher-Schlüssel (Bot-Check-Bypass der Auth-Routen).
//  - Entwicklung: aus der Laufzeit-.env (SKETCHY_LAUNCHER_KEY).
//  - Gepackter Build: aus dem zur Build-Zeit generierten, git-ignorierten Modul
//    src/config/launcherKey.js (leicht verschleiert, im ASAR gebündelt). Siehe forge.config.js.
// HINWEIS: Ein in einem verteilten Client mitgelieferter Shared-Key ist prinzipiell extrahierbar —
// die Verschleierung erhöht nur die Hürde. Robustere Alternative wäre Cloudflare Turnstile.
function loadEmbeddedLauncherKey(){
	try { return require("./config/launcherKey") || "" }
	catch { return "" }
}
const LAUNCHER_KEY = process.env.SKETCHY_LAUNCHER_KEY || loadEmbeddedLauncherKey()

/** Baut die vollständige URL für einen /v1-relativen (oder absoluten) Pfad. */
function apiUrl(path) {
	if (/^https?:\/\//i.test(path)) return path // bereits absolut (z.B. server-gelieferte Medien-URLs)
	return API_BASE + (path.startsWith("/") ? path : "/" + path)
}

/**
 * Standard-Header für einen API-Aufruf: JSON, optionaler Bearer-Token (Session) und der
 * Launcher-Schlüssel (für die Bot-Check-Ausnahme der Auth-Routen).
 * @param {{ token?: string|null, json?: boolean }} [opts]
 */
function apiHeaders(opts = {}) {
	const headers = {}
	if (opts.json !== false) headers["Content-Type"] = "application/json"
	if (opts.token) headers["Authorization"] = "Bearer " + opts.token
	if (LAUNCHER_KEY) headers["X-Launcher-Key"] = LAUNCHER_KEY
	return headers
}

module.exports = { API_BASE, LAUNCHER_KEY, apiUrl, apiHeaders }
