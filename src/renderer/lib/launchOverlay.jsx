import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { whenBlurred, whenFocused } from "./whenFocused.js"
import { REVEAL_MS } from "./motion.js"
import LaunchOverlay from "../components/LaunchOverlay.jsx"

// Zeigt beim Spielstart einen bildschirmfüllenden Startbildschirm. Aufgebaut wie
// lib/notifications.jsx: der Provider hält den Zustand und rendert die Darstellung gleich selbst.
//
// Lebenszyklus (der Server meldet nur „Prozess gestartet", nicht „Spielfenster ist da"):
//   1. warten, bis der Launcher den Fokus VERLIERT — dann hat das Spiel übernommen bzw. der
//      Launcher hat sich laut `actionAfterGameStarted` selbst versteckt,
//   2. warten, bis er ihn ZURÜCKBEKOMMT — der Nutzer sieht beim Zurückwechseln noch, was lief,
//   3. ausblenden.
// Ohne Schritt 1 (Spiel öffnet nie ein Fenster, Einstellung „Offen lassen") bliebe das Overlay
// ewig stehen — dagegen der Deckel unten und Esc/Klick in der Darstellung.
const CAP_MS = 20000

const LaunchCtx = createContext(null)

export function LaunchOverlayProvider({ children }) {
	const [launch, setLaunch] = useState(null) // { id, name, title, origin, openedAt }
	const idRef = useRef(0)
	// Aktueller Stand für `close()` — der State-Updater darf keine Timer starten (StrictMode ruft ihn
	// doppelt auf).
	const launchRef = useRef(null)
	launchRef.current = launch

	// `name` ist die Spiel-id (eindeutig) und dient nur dem Button-Highlight; `title` ist der
	// Anzeigename im Overlay.
	const open = useCallback((name, title, origin) => {
		const id = ++idRef.current
		setLaunch({ id, name, title, origin, openedAt: Date.now() })
		return id
	}, [])

	// Schließt nur, wenn noch derselbe Start läuft (`id`), und nie mitten im Aufziehen des Kreises —
	// ein Fehlschlag nach 20 ms würde sonst als Zucken erscheinen.
	const close = useCallback((id) => {
		const current = launchRef.current
		if (!current || (id != null && current.id !== id)) return
		const target = current.id
		const wait = Math.max(0, REVEAL_MS - (Date.now() - current.openedAt))
		setTimeout(() => {
			if (launchRef.current?.id === target) setLaunch(null)
		}, wait)
	}, [])

	const launchId = launch?.id
	useEffect(() => {
		if (!launchId) return
		const abort = new AbortController()
		let capTimer = setTimeout(() => {
			// Nie ein Fokusverlust — das Spiel ist offenbar nicht nach vorne gekommen.
			abort.abort()
			close(launchId)
		}, CAP_MS)
		;(async () => {
			await whenBlurred(abort.signal)
			clearTimeout(capTimer)
			await whenFocused(abort.signal)
			close(launchId)
		})()
		return () => {
			abort.abort()
			clearTimeout(capTimer)
		}
	}, [launchId, close])

	const launchingName = launch?.name ?? null
	const value = useMemo(() => ({ open, close, launchingName }), [open, close, launchingName])

	return (
		<LaunchCtx.Provider value={value}>
			{children}
			<AnimatePresence>
				{launch && (
					<LaunchOverlay
						key={launch.id}
						title={launch.title}
						origin={launch.origin}
						onDismiss={() => close(launch.id)}
					/>
				)}
			</AnimatePresence>
		</LaunchCtx.Provider>
	)
}

export function useLaunchOverlay() {
	const ctx = useContext(LaunchCtx)
	if (!ctx) throw new Error("useLaunchOverlay must be used within LaunchOverlayProvider")
	return ctx
}
