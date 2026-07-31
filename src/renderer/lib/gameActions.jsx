import { send } from "./api.js"
import { useNotify } from "./notifications.jsx"
import { useDialog } from "./dialog.jsx"
import { useLaunchOverlay } from "./launchOverlay.jsx"

/**
 * Geteilte Spiel-Aktionen (Start / Ordner öffnen / Deinstallieren) — von Bibliothek, Produktseite,
 * Startseite und Kontextmenü gemeinsam genutzt. Payload einheitlich { filepath: item.start,
 * name: item.name }. `item` ist ein Install-Datensatz (name = Spiel-id, start = ausführbarer Pfad,
 * title).
 */

/**
 * Ursprung des Kreis-Reveals: Mitte des geklickten Elements, sonst die Mausposition, sonst die
 * Fenstermitte. Muss synchron ausgelesen werden — React setzt `currentTarget` nach dem Handler
 * zurück.
 */
function originFromEvent(event) {
	const rect = event?.currentTarget?.getBoundingClientRect?.()
	if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
	if (typeof event?.clientX === "number") return { x: event.clientX, y: event.clientY }
	return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

export function useGameActions() {
	const notify = useNotify()
	const { confirm } = useDialog()
	const { open: openLaunch, close: closeLaunch, launchingName } = useLaunchOverlay()

	async function play(item, event) {
		const id = openLaunch(item.name, item.title || item.name, originFromEvent(event))
		try {
			// send() ist bewusst „weich" und wirft NICHT bei status:0 — der Server meldet einen
			// fehlenden/ungültigen Startpfad genau so. Ohne diese Prüfung liefe das Overlay weiter,
			// obwohl gar nichts gestartet wurde.
			const res = await send("/api/games/start", { filepath: item.start, name: item.name }, true)
			if (!res || res.status !== 1) {
				closeLaunch(id)
				notify("Fehler", typeof res?.data === "string" ? res.data : "Das Spiel konnte nicht gestartet werden.", "error")
			}
			// Erfolg: kein Toast — das Overlay sagt es bereits und bleibt stehen, bis der Nutzer
			// aus dem Spiel zurückkommt (siehe lib/launchOverlay.jsx).
		} catch (err) {
			closeLaunch(id)
			notify("Fehler", "Konnte nicht starten: " + err, "error")
		}
	}

	async function openFolder(item) {
		try {
			await send("/api/games/open", { filepath: item.start, name: item.name }, true)
		} catch (err) {
			notify("Fehler", String(err), "error")
		}
	}

	async function remove(item, onDone) {
		if (!(await confirm("Deinstallieren?", `Soll „${item.title || item.name}“ wirklich entfernt werden?`))) return
		try {
			await send("/api/games/delete", { filepath: item.start, name: item.name }, true)
			notify("Entfernt", `${item.title || item.name} wurde deinstalliert.`, "note")
			onDone?.()
		} catch (err) {
			notify("Fehler", String(err), "error")
		}
	}

	return { play, openFolder, remove, launchingName }
}
