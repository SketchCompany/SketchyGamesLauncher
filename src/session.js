// Session-Token-Speicher des Launchers. Ersetzt die frühere Praxis, das ROHE Nutzerobjekt
// inkl. (client-AES-verschlüsseltem) Passwort in user.data zu halten. Gespeichert wird jetzt
// nur noch { token, userId, expiresAt } — AES-256-GCM-verschlüsselt mit dem Per-Installations-
// Schlüssel (dataKey.js, via safeStorage/OS-Keychain gewrappt). Der Token ist ein RS256-Session-
// JWT der API; das Passwort wird NIE mehr persistiert.
const fs = require("fs")
const path = require("path")
const config = require("./launcherConfig")
const { encrypt, decrypt } = require("./functions")

const sessionFile = path.join(config.data, "session.dat")

/**
 * Dekodiert das Payload eines JWT OHNE Signaturprüfung (der Launcher vertraut seinem eigenen,
 * gerade von der API erhaltenen Token). Liefert z.B. { id, sessionId } oder null.
 */
function decodeToken(token) {
	try {
		const payload = String(token).split(".")[1]
		if (!payload) return null
		return JSON.parse(Buffer.from(payload, "base64").toString("utf8"))
	} catch {
		return null
	}
}

/** Speichert Token + Metadaten verschlüsselt. userId wird bei Bedarf aus dem Token abgeleitet. */
function saveSession(session) {
	try {
		const userId = session.userId || decodeToken(session.token)?.id || null
		fs.writeFileSync(sessionFile, encrypt(JSON.stringify({ token: session.token, userId, expiresAt: session.expiresAt || null })))
	} catch (err) {
		console.error("saveSession:", err)
	}
}

/** userId der aktuellen Session (aus der Datei bzw. aus dem Token). */
function getUserId() {
	const s = loadSession()
	if (!s) return null
	return s.userId || decodeToken(s.token)?.id || null
}

/** Liest die gespeicherte Session ({ token, userId, expiresAt }) oder null. */
function loadSession() {
	try {
		if (!fs.existsSync(sessionFile)) return null
		const data = JSON.parse(decrypt(fs.readFileSync(sessionFile, "utf8")))
		if (!data || !data.token) return null
		return data
	} catch (err) {
		// Beschädigt/legacy → verwerfen, Nutzer meldet sich neu an.
		console.warn("loadSession: unlesbar/legacy, wird verworfen:", err.message)
		return null
	}
}

/** Aktueller Bearer-Token oder null. */
function getToken() {
	const s = loadSession()
	return s ? s.token : null
}

/** true, wenn eine Session gespeichert ist. */
function isLoggedIn() {
	return !!getToken()
}

/**
 * true, wenn eine Session gespeichert UND (lokal erkennbar) noch nicht abgelaufen ist.
 * Prüft rein lokal das JWT-`exp` (Sekunden) bzw. das gespeicherte `expiresAt` — kein Netzwerk,
 * damit der Start schnell bleibt. Widerrufene, aber noch nicht abgelaufene Tokens werden hier
 * NICHT erkannt (das fängt der erste API-Aufruf über die 401-Behandlung ab).
 */
function isSessionValid() {
	const s = loadSession()
	if (!s || !s.token) return false
	const now = Date.now()
	if (s.expiresAt) {
		const exp = typeof s.expiresAt === "number" ? s.expiresAt : Date.parse(s.expiresAt)
		if (!Number.isNaN(exp) && exp <= now) return false
	}
	const exp = decodeToken(s.token)?.exp
	if (typeof exp === "number" && exp * 1000 <= now) return false
	return true
}

/**
 * Fragt den Server, ob die gespeicherte Sitzung noch lebt — die EINZIGE netzberührende Funktion
 * hier; `isSessionValid()` bleibt der schnelle lokale Check für den Start.
 *
 * Nötig, weil eine serverseitig beendete Sitzung (Abmelden auf der Website, Passwortwechsel) lokal
 * nicht zu erkennen ist: das JWT bleibt bis `exp` formal gültig. Bibliothek und Spielstart sind
 * bewusst token-frei, es gibt also keinen API-Aufruf, der den Widerruf sonst auffliegen ließe.
 *
 * Dreiwertig, und das ist der Kern: „ungültig" und „konnte nicht prüfen" dürfen nicht dasselbe
 * auslösen, sonst wirft ein Serverausfall alle Nutzer raus.
 * @returns {Promise<boolean|null>} true = gültig, false = beendet (Session wurde gelöscht),
 *   null = keine Aussage möglich (offline, Server nicht erreichbar, Serverfehler) → nichts tun.
 */
async function verifyRemote() {
	const token = getToken()
	if (!token) return false
	if (!isSessionValid()) { clearSession(); return false } // lokal schon abgelaufen
	const func = require("./functions")
	try {
		if (await func.checkInternetConnection() != 2) return null
	} catch {
		return null
	}
	try {
		await func.send("/v1/auth/session/get", {}, { token })
		return true
	} catch (err) {
		if (err instanceof func.ApiError && err.status === 401) {
			console.log("verifyRemote: Sitzung wurde serverseitig beendet")
			clearSession()
			return false
		}
		// Alles andere (Netzabbruch, 5xx, Rate-Limit) ist KEIN Beweis für einen Widerruf.
		console.warn("verifyRemote: konnte nicht prüfen:", err && err.message)
		return null
	}
}

/** Meldet ab: löscht die Session-Datei. */
function clearSession() {
	try {
		if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile)
	} catch (err) {
		console.error("clearSession:", err)
	}
}

module.exports = { saveSession, loadSession, getToken, getUserId, decodeToken, isLoggedIn, isSessionValid, verifyRemote, clearSession, sessionFile }
