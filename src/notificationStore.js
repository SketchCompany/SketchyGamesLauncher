// Prozessweiter, persistenter Benachrichtigungs-Store (Glocken-Fenster). Wird von api.js (Routen),
// downloadEngine.js und index.js geteilt — alle laufen im selben Main-Prozess, teilen also dieses
// Modul-Singleton. Persistiert nach config.notificationsFile (plain JSON), damit Benachrichtigungen
// einen Neustart überleben. OS-Benachrichtigung optional über func.sendNotification.
//
// Sicherheit: es werden NUR deklarative Daten gespeichert (Titel/Text/Typ + Aktions-Deskriptoren),
// niemals Funktions-Strings (frühere RCE über eval'te Callbacks). Die HTTP-Route validiert Eingaben.

let items = []      // In-Memory-Cache (Spiegel der Datei)
let loaded = false
let nextId = 1
const CAP = 50      // max. nicht-gepinnte Einträge (älteste fallen raus)

// Lazy requires vermeiden eine Ladezyklus-Abhängigkeit (launcherConfig ↔ notificationStore).
function config() { return require("./launcherConfig") }
function func() { return require("./functions") }

async function load() {
	if (loaded) return
	loaded = true
	try {
		const raw = JSON.parse(await func().read(config().notificationsFile))
		items = Array.isArray(raw?.notifications) ? raw.notifications : []
	} catch { items = [] }
	for (const n of items) if (typeof n.id === "number" && n.id >= nextId) nextId = n.id + 1
}

async function persist() {
	try { await func().write(config().notificationsFile, JSON.stringify({ notifications: items }, null, 3)) }
	catch (err) { console.error("notificationStore.persist:", err) }
}

async function list() {
	await load()
	return items
}

async function add(n, { os = false } = {}) {
	await load()
	// Idempotent per key: existiert der key bereits, NICHTS tun (kein erneuter Toast/OS-Spam bei
	// wiederholten Checks). Neu erzeugen erst wieder, wenn der Eintrag entfernt/aktioniert wurde.
	if (n.key) {
		const existing = items.find(x => x.key === n.key)
		if (existing) return existing
	}
	const notification = {
		id: nextId++,
		...(n.key ? { key: n.key } : {}),
		type: n.type || "note",
		title: n.title || "",
		message: n.message || "",
		...(Array.isArray(n.actions) && n.actions.length ? { actions: n.actions } : {}),
		...(n.pinned ? { pinned: true } : {}),
		read: false,
		createdAt: Date.now(),
	}
	items.push(notification)
	// Cap: älteste NICHT-gepinnte entfernen, bis <= CAP.
	let over = items.filter(x => !x.pinned).length - CAP
	for (let i = 0; i < items.length && over > 0;) {
		if (!items[i].pinned) { items.splice(i, 1); over-- } else i++
	}
	await persist()
	if (os) {
		try { func().sendNotification(notification.title, notification.message) }
		catch (err) { console.error("notificationStore os:", err) }
	}
	return notification
}

async function remove(id, { force = false } = {}) {
	await load()
	const i = items.findIndex(x => x.id === id)
	if (i === -1) return items
	if (items[i].pinned && !force) return items // pinned: nicht per Nutzer entfernbar
	items.splice(i, 1)
	await persist()
	return items
}

async function removeByKey(key, { force = false } = {}) {
	await load()
	const i = items.findIndex(x => x.key === key)
	if (i === -1) return items
	if (items[i].pinned && !force) return items
	items.splice(i, 1)
	await persist()
	return items
}

async function removeAll() {
	await load()
	items = items.filter(x => x.pinned) // pinned bleiben erhalten
	await persist()
	return items
}

async function markAllRead() {
	await load()
	let changed = false
	for (const n of items) if (!n.read) { n.read = true; changed = true }
	if (changed) await persist()
	return items
}

module.exports = { load, list, add, remove, removeByKey, removeAll, markAllRead }
