// Client-Helfer rund um die persistenten Benachrichtigungen (Server-Store /api/notifications).
import { send } from "./api.js"

// Ids, die im Renderer bereits als Toast gezeigt wurden — verhindert, dass der 10s-Poll in
// AppShell dieselbe (gerade lokal erzeugte) Benachrichtigung erneut als Toast zeigt.
export const toastedIds = new Set()

// Sagt AppShell Bescheid, die Glocken-Liste sofort neu zu laden (statt bis zu 10s zu warten).
function signalChange() {
	try { window.dispatchEvent(new Event("sgl:notifications-changed")) } catch { /* noop */ }
}

/**
 * Wichtige, aktionspflichtige Benachrichtigung: SOFORT als Toast zeigen UND serverseitig
 * persistieren (erscheint in der Glocke, überlebt Neustart). `notify` = useNotify()-Funktion.
 */
export async function persistImportant(notify, { title, message, type = "note", actions, key, pinned } = {}) {
	notify(title, message, type, actions && actions.length ? 12000 : 8000, { actions })
	try {
		const created = await send("/api/notifications/add", { title, message, type, actions, key, pinned })
		if (created && typeof created.id === "number") toastedIds.add(created.id)
		signalChange()
		return created
	} catch { return null }
}

/** Eine gespeicherte Benachrichtigung entfernen (Dismiss/Aktion). Gepinnte lehnt der Server ab. */
export function removeServerNotification(id) {
	return send("/api/notifications/remove", { id }).then(signalChange).catch(() => {})
}
