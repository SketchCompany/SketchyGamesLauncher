// Ursachen-Klassifizierung für Ladefehler — übersetzt einen AppError (lib/api.js) in eine
// von der UI benennbare Ursache. Zwei Stufen:
//  - describeCauseSync(err): sofortige Best-Guess-Ursache allein aus dem Fehler (kein Netz).
//  - resolveCause(err): verfeinert asynchron über navigator.onLine + den /api/connection-Probe.
import { getConnection } from "./api.js"

export const CAUSE = {
	OFFLINE: "offline",
	SERVER_UNREACHABLE: "server-unreachable",
	SERVER_ERROR: "server-error",
	NOT_FOUND: "not-found",
	SESSION: "session",
	UNKNOWN: "unknown",
}

/** Schnelle Ursache ohne Netzabfrage — für die erste Anzeige, bevor resolveCause verfeinert. */
export function describeCauseSync(err) {
	const kind = err?.kind
	const offline = typeof navigator !== "undefined" && navigator.onLine === false
	if (kind === "session") return CAUSE.SESSION
	if (kind === "local") return offline ? CAUSE.OFFLINE : CAUSE.SERVER_UNREACHABLE
	if (kind === "http") {
		if (err.httpStatus === 404) return CAUSE.NOT_FOUND
		if (err.httpStatus >= 500) return CAUSE.SERVER_ERROR
		return CAUSE.SERVER_ERROR
	}
	if (kind === "server") return CAUSE.SERVER_ERROR
	// Kein AppError (z.B. ein roher throw irgendwo) → nicht online? sonst unbekannt.
	if (typeof navigator !== "undefined" && navigator.onLine === false) return CAUSE.OFFLINE
	return CAUSE.UNKNOWN
}

/**
 * Verfeinerte Ursache. Nutzt navigator.onLine (sofort) und – falls das nicht reicht – den
 * vorhandenen /api/connection-Probe (0/1/2). Kostet im schlimmsten Fall einen ~3s-Roundtrip;
 * die UI zeigt derweil bereits describeCauseSync und ersetzt es danach.
 */
export async function resolveCause(err) {
	if (err?.kind === "session") return CAUSE.SESSION
	if (typeof navigator !== "undefined" && navigator.onLine === false) return CAUSE.OFFLINE

	let conn
	try { conn = await getConnection() } catch { conn = 0 }
	// 0 = kein Zugang zu unserem API-Host, 1 = Internet, aber Server bestätigt nicht.
	if (conn === 0 || conn === 1) return CAUSE.SERVER_UNREACHABLE

	// conn === 2: Verbindung + Server stehen → der ursprüngliche Fehler war ein echter Fehler.
	if (err?.httpStatus === 404) return CAUSE.NOT_FOUND
	return CAUSE.SERVER_ERROR
}

/**
 * Cause-abhängiger Fehler-Toast für Mid-Session-Ausfälle (Verbindung/API bricht bei einer
 * Aktion weg). Synchron → sofortiger Toast (kein 3s-Probe). Verbindungsprobleme werden als
 * „warning" (amber) gemeldet, echte Server-/Validierungsfehler als „error" (rot) mit dem
 * konkreten Servertext (z.B. „Code ungültig"). `context` beschreibt die fehlgeschlagene Aktion.
 */
export function notifyError(notify, err, { title = "Fehler", context } = {}) {
	const cause = describeCauseSync(err)
	if (cause === CAUSE.OFFLINE) {
		notify(context || title, "Keine Internetverbindung. Die Aktion wurde nicht ausgeführt — bitte versuch es erneut.", "warning")
		return cause
	}
	if (cause === CAUSE.SERVER_UNREACHABLE) {
		notify(context || title, "Server nicht erreichbar. Die Aktion wurde nicht ausgeführt — bitte versuch es gleich nochmal.", "warning")
		return cause
	}
	if (cause === CAUSE.SESSION) {
		notify("Sitzung abgelaufen", "Bitte melde dich erneut an.", "warning")
		return cause
	}
	// Server erreichbar, aber Fehler → konkrete Server-/Validierungsmeldung zeigen.
	const detail = err?.message || String(err)
	notify(title, context ? `${context}: ${detail}` : detail, "error")
	return cause
}

/**
 * Toast, wenn „Erneut versuchen" wieder fehlschlägt. IMMER als Warnung (amber) und an die genaue
 * Ursache angepasst (Internet vs. Server nicht verfügbar). Nutzt den asynchronen resolveCause-Probe,
 * damit Proxy-Fehler (status:0 = Remote nicht erreichbar) korrekt als Verbindungsproblem gemeldet
 * werden und nicht als roter „Serverfehler".
 */
export async function notifyRetryFailed(notify, err) {
	const cause = await resolveCause(err)
	if (cause === CAUSE.OFFLINE) {
		notify("Keine Internetverbindung", "Der erneute Versuch ist fehlgeschlagen — prüfe deine Verbindung und versuch es nochmal.", "warning")
	} else if (cause === CAUSE.SERVER_UNREACHABLE) {
		notify("Server nicht erreichbar", "Der erneute Versuch ist fehlgeschlagen — bitte versuch es gleich nochmal.", "warning")
	} else if (cause === CAUSE.SESSION) {
		notify("Sitzung abgelaufen", "Bitte melde dich erneut an.", "warning")
	} else {
		notify("Erneut versuchen fehlgeschlagen", err?.message || "Bitte versuch es später erneut.", "warning")
	}
	return cause
}
