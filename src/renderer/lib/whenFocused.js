// Warten auf Fenster-Zustandswechsel — gebraucht bei Abläufen, die den Nutzer aus dem Launcher
// hinausführen (Social-Login im Systembrowser, Spielstart):
//   whenFocused() — bis das Fenster wieder vorne und sichtbar ist. Eine Meldung, die abläuft,
//                   während der Nutzer noch woanders ist, sieht er nie.
//   whenBlurred() — bis der Launcher den Fokus verliert, also etwas anderes übernommen hat
//                   (das startende Spiel, oder der Launcher versteckt sich selbst).
// Ist der gewünschte Zustand schon erreicht, lösen die Promises sofort auf.
//
// Beide nehmen optional ein AbortSignal. Nach dem Abbruch werden die Listener entfernt und das
// Promise löst NIE auf — der Aufrufer wartet ohnehin nicht mehr darauf.
//
// Nutzung:
//   await whenFocused()
//   notify("…", "…", "error")

export function whenFocused(signal) {
	return waitFor(isForeground, signal)
}

export function whenBlurred(signal) {
	return waitFor(() => !isForeground(), signal)
}

function waitFor(isDone, signal) {
	if (isDone()) return Promise.resolve()
	if (signal?.aborted) return new Promise(() => {})
	return new Promise(resolve => {
		const check = () => {
			if (!isDone()) return
			cleanup()
			resolve()
		}
		function cleanup() {
			// „focus"/„blur" decken das Wechseln zwischen Programmen ab, „visibilitychange" das
			// Verstecken/Wiederherstellen aus dem Tray oder minimiert (dort feuert focus nicht
			// zuverlässig).
			window.removeEventListener("focus", check)
			window.removeEventListener("blur", check)
			document.removeEventListener("visibilitychange", check)
			signal?.removeEventListener("abort", cleanup)
		}
		window.addEventListener("focus", check)
		window.addEventListener("blur", check)
		document.addEventListener("visibilitychange", check)
		signal?.addEventListener("abort", cleanup)
	})
}

function isForeground() {
	return document.visibilityState === "visible" && document.hasFocus()
}
