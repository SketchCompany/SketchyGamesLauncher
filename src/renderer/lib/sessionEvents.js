/**
 * Kontowechsel im Renderer bekanntgeben.
 *
 * Die Provider für Store und Wunschliste hängen ÜBER dem Router (main.jsx) und hydrieren genau
 * einmal pro Prozess. Nach einem An-/Abmelden navigiert der Renderer nur (kein Reload), sonst
 * blieben die nutzerabhängigen Daten des Vorgängers stehen — allen voran das `owned`-Flag jedes
 * Spiels. Ein Reload wäre die grobe Lösung; er würde aber u.a. den gerade gezeigten
 * „Angemeldet"-Toast verschlucken. Deshalb dieses kleine Ereignis: wer nutzerabhängige Daten hält,
 * hört darauf und lädt sie neu.
 */
export const SESSION_CHANGED = "sgl:session-changed"

/** Nach jedem Login/Logout aufrufen. */
export function notifySessionChanged() {
	window.dispatchEvent(new Event(SESSION_CHANGED))
}

/** Abonnieren; liefert die Abmeldefunktion (für useEffect-Cleanup). */
export function onSessionChanged(handler) {
	window.addEventListener(SESSION_CHANGED, handler)
	return () => window.removeEventListener(SESSION_CHANGED, handler)
}
