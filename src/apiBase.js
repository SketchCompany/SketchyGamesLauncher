// Zentrale API-Konfiguration des Launchers. Früher stand die Basis-URL als String-Literal
// überall im Code — jetzt gibt es genau EINE Quelle. Alle Aufrufe der zentralen API laufen
// über API_BASE + einen Pfad unter /v1 (siehe V1-MIGRATION.md der API).
//
// Der Launcher hat kein Turnstile-Widget; er umgeht die Bot-Prüfung der Auth-Routen über den
// geteilten Geheimschlüssel LAUNCHER_KEY (Header X-Launcher-Key == env LAUNCHER_SHARED_SECRET
// der API). Lockout + Rate-Limit greifen serverseitig weiter.

// Überschreibbar für lokale Entwicklung (z.B. SKETCHY_API_BASE=http://localhost:3500).
const API_BASE = (process.env.SKETCHY_API_BASE || "https://api.sketch-company.de").replace(/\/+$/, "")

// Geteilter Launcher-Schlüssel (Bot-Check-Bypass). In der Produktion über die Build-Umgebung
// gesetzt; ist er leer, muss die API LAUNCHER_SHARED_SECRET ebenfalls leer haben (Bypass aus).
const LAUNCHER_KEY = process.env.SKETCHY_LAUNCHER_KEY || ""

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
