// Besitz-Cache des Launchers: welche Spiele gehören welchem Konto?
//
// Die Installations-Registry (installsFile) ist maschinenglobal — sie weiß nicht, wem ein Spiel
// gehört. Die Wahrheit dazu liegt serverseitig in den Lizenzen (/v1/library). Damit Bibliothek und
// Spielstart auch OFFLINE korrekt filtern (beides ist bewusst token-frei), spiegeln wir die Menge
// der besessenen Spiel-Ids pro userId lokal — AES-256-GCM-verschlüsselt wie settings.data.
//
// WICHTIG — das ist eine Darstellungs-/Komfortgrenze, KEIN Kopierschutz. Die Datei liegt auf dem
// Rechner des Nutzers und die Spieldateien bleiben ohnehin liegen. Durchgesetzt wird der Besitz da,
// wo es zählt: serverseitig (/v1/store/:id/download-url → 403 NO_LICENSE, /v1/library/claim).
//
// Leitplanke: UNBEKANNTER Besitz ⇒ NICHT filtern. Nur wenn für den aktuellen (bzw. zuletzt
// angemeldeten) Nutzer ein Cache existiert, wird gefiltert. Sonst würde ein frisch aktualisierter
// Launcher, ein Offline-Erststart oder ein fehlgeschlagener /v1/library-Aufruf den rechtmäßigen
// Besitzer aus seiner eigenen Bibliothek aussperren.
//
// functions/session/launcherConfig werden bewusst LAZY (in den Funktionen) geladen: functions.js
// zieht electron, und so bleibt die reine Logik (partition) auch außerhalb von Electron testbar.
const fs = require("fs")
const path = require("path")

const FILE_VERSION = 1

let cache = null // { version, lastUserId, users: { <userId>: { ids, at, source } } }

function config() { return require("./launcherConfig") }
function func() { return require("./functions") }
function session() { return require("./session") }

function file() { return path.join(config().data, "ownership" + config().ext) }

function empty() { return { version: FILE_VERSION, lastUserId: null, users: {} } }

/** Liest die Datei (mit In-Memory-Cache). Nie werfen — im Zweifel „nichts bekannt". */
function load() {
	if (cache) return cache
	try {
		if (!fs.existsSync(file())) return (cache = empty())
		const parsed = JSON.parse(func().decrypt(fs.readFileSync(file(), "utf8")))
		if (!parsed || typeof parsed !== "object" || !parsed.users) return (cache = empty())
		cache = { version: FILE_VERSION, lastUserId: parsed.lastUserId || null, users: parsed.users }
	} catch (err) {
		// Beschädigt/legacy → verwerfen. „Nichts bekannt" heißt: nicht filtern (siehe Leitplanke).
		console.warn("ownership.load: unlesbar, wird verworfen:", err.message)
		cache = empty()
	}
	return cache
}

function save(next) {
	cache = next
	try {
		fs.writeFileSync(file(), func().encrypt(JSON.stringify(next)))
	} catch (err) {
		console.error("ownership.save:", err)
	}
}

/** Konto, dessen Besitz gerade gilt: die laufende Session, sonst das zuletzt angemeldete. */
function currentUserId() {
	try {
		return session().getUserId() || load().lastUserId || null
	} catch {
		return load().lastUserId || null
	}
}

/**
 * Die besessenen Spiel-Ids eines Kontos — oder null, wenn dazu NICHTS bekannt ist.
 * null ist die entscheidende Antwort: Aufrufer dürfen dann nicht filtern.
 * @returns {Set<string>|null}
 */
function ownedIds(userId = currentUserId()) {
	if (!userId) return null
	const entry = load().users[userId]
	if (!entry || !Array.isArray(entry.ids)) return null
	return new Set(entry.ids)
}

/** true, wenn das Spiel dem Konto gehört ODER der Besitz unbekannt ist (Leitplanke). */
function owns(gameId, userId = currentUserId()) {
	const ids = ownedIds(userId)
	if (!ids) return true
	return ids.has(String(gameId))
}

/** Dreiwertig für Aufrufer, die „unbekannt" anders behandeln wollen: true | false | null. */
function state(gameId, userId = currentUserId()) {
	const ids = ownedIds(userId)
	if (!ids) return null
	return ids.has(String(gameId))
}

/**
 * Teilt eine Registry-Liste in eigene/fremde Spiele. Reine Funktion (kein fs, kein Netz) — der
 * head-less testbare Kern dieses Moduls.
 * @param {Array<{name?: string, id?: string}>} games
 * @param {Set<string>|null} ids `null` = Besitz unbekannt ⇒ alles gilt als eigen
 */
function partition(games, ids) {
	const list = Array.isArray(games) ? games : []
	if (!ids) return { owned: list, foreign: [], unknown: true }
	const owned = []
	const foreign = []
	for (const g of list) {
		const key = String((g && (g.name || g.id)) || "")
		if (ids.has(key)) owned.push(g)
		else foreign.push(g)
	}
	return { owned, foreign, unknown: false }
}

/** partition() für die aktuelle Session — die Form, die api.js braucht. */
function partitionForCurrentUser(games) {
	return partition(games, ownedIds())
}

/**
 * Ein einzelnes Spiel sofort als besessen vermerken (nach erfolgreichem claim/Lizenzcheck), damit
 * die Bibliothek nicht bis zum nächsten refresh() wartet. Ohne bestehenden Cache passiert nichts —
 * „unbekannt" bleibt unbekannt (und damit ungefiltert), statt eine halbe Wahrheit anzulegen.
 */
function markOwned(gameId, userId = currentUserId()) {
	if (!userId || !gameId) return
	const data = load()
	const entry = data.users[userId]
	if (!entry || !Array.isArray(entry.ids)) return
	if (entry.ids.includes(String(gameId))) return
	entry.ids = [...entry.ids, String(gameId)]
	entry.at = Date.now()
	save({ ...data, users: { ...data.users, [userId]: entry } })
}

/** Merkt sich das zuletzt angemeldete Konto. Liefert, ob es ein ANDERES als vorher ist. */
function noteLogin(userId) {
	const data = load()
	const switched = !!userId && !!data.lastUserId && data.lastUserId !== userId
	if (userId && data.lastUserId !== userId) save({ ...data, lastUserId: userId })
	return { switched }
}

/**
 * Holt die Lizenzen des Kontos von der API und ERSETZT den lokalen Stand — aber nur bei Erfolg.
 * Ein Fehlschlag darf den Cache nie leeren (sonst wandert die halbe Bibliothek in „fremd").
 * @returns {Promise<boolean>} true, wenn aktualisiert wurde
 */
async function refresh(token, userId = null) {
	const id = userId || currentUserId()
	if (!token || !id) return false
	try {
		const rows = await func().get("/v1/library", { token })
		if (!Array.isArray(rows)) return false
		const ids = rows.map(r => r && (r.id || r.game_id || r.gameId)).filter(x => typeof x === "string")
		const data = load()
		save({
			...data,
			lastUserId: id,
			users: { ...data.users, [id]: { ids, at: Date.now(), source: "server" } },
		})
		return true
	} catch (err) {
		console.warn("ownership.refresh: Lizenzen konnten nicht geladen werden:", err && err.message)
		return false
	}
}

/**
 * Legt (idempotent) einen Hinweis auf Installationen an, die dem aktuellen Konto NICHT gehören —
 * die Dateien bleiben ja liegen, also soll der Nutzer sie in den Einstellungen aufräumen können.
 */
async function reportForeign() {
	try {
		const userId = currentUserId()
		const ids = ownedIds(userId)
		if (!userId || !ids) return // unbekannt → nichts behaupten
		const installs = JSON.parse(await func().read(config().installsFile))
		const { foreign } = partition(installs.games, ids)
		if (foreign.length === 0) return
		await require("./notificationStore").add({
			key: "foreign-installs:" + userId,
			type: "note",
			title: "Installationen anderer Konten",
			message: `${foreign.length} ${foreign.length === 1 ? "Spiel gehört" : "Spiele gehören"} nicht zu deinem Konto und ${foreign.length === 1 ? "wird" : "werden"} nicht angezeigt.`,
			actions: [{ kind: "navigate", to: "/settings?tab=downloads", label: "Aufräumen" }],
		})
	} catch (err) {
		console.error("ownership.reportForeign:", err)
	}
}

/** refresh() + Hinweis in einem Rutsch (der übliche Aufruf an allen Aktualisierungspunkten). */
async function sync(token, userId = null) {
	const ok = await refresh(token, userId)
	if (ok) await reportForeign()
	return ok
}

/** Nur für Tests/Abmelden: In-Memory-Cache verwerfen. */
function invalidate() { cache = null }

module.exports = {
	ownedIds,
	owns,
	state,
	partition,
	partitionForCurrentUser,
	markOwned,
	noteLogin,
	refresh,
	reportForeign,
	sync,
	currentUserId,
	invalidate,
}
