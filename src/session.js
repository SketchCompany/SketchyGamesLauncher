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

/** Meldet ab: löscht die Session-Datei. */
function clearSession() {
	try {
		if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile)
	} catch (err) {
		console.error("clearSession:", err)
	}
}

module.exports = { saveSession, loadSession, getToken, getUserId, decodeToken, isLoggedIn, clearSession, sessionFile }
