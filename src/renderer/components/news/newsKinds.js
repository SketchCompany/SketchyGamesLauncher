// Darstellung der Feed-Arten an EINER Stelle — Symbol, Beschriftung, Akzentfarbe und Linkziel.
// Die Art wird immer als Symbol UND Text gezeigt: Farbe allein darf keine Bedeutung tragen.
// Die Codes kommen aus /v1/feed (api/newsDatabase.ts → getFeed).
export const NEWS_KINDS = {
	update: { label: "Update", icon: "bi-box-arrow-down", accent: "text-neon-green", ring: "border-l-neon-green" },
	event: { label: "Event", icon: "bi-calendar-event", accent: "text-neon-cyan", ring: "border-l-neon-cyan" },
	news: { label: "Neuigkeit", icon: "bi-megaphone", accent: "text-neon-cyan", ring: "border-l-neon-cyan" },
	announcement: { label: "Sketch Company", icon: "bi-stars", accent: "text-neon-amber", ring: "border-l-neon-amber" },
	launcher: { label: "Launcher", icon: "bi-window-stack", accent: "text-text-secondary", ring: "border-l-border-strong" },
}

export function kindOf(item) {
	return NEWS_KINDS[item?.kind] || NEWS_KINDS.news
}

/**
 * Wohin die Karte führt. Updates und Launcher-Hinweise zeigen Versionshinweise, Beiträge zum
 * Spiel führen auf dessen Produktseite. Ohne sinnvolles Ziel gibt es keinen Link (die Karte
 * bleibt dann statischer Text statt eines toten Klicks).
 */
export function linkFor(item) {
	if (!item) return null
	if (item.kind === "launcher") return `/news/launcher/${encodeURIComponent(item.version || "")}`
	if (item.kind === "update" && item.gameId) return `/news/game/${encodeURIComponent(item.gameId)}/${encodeURIComponent(item.version || "")}`
	if (item.gameId) return `/store/${encodeURIComponent(item.gameId)}`
	return null
}

/** „vor 3 Std." statt eines rohen Zeitstempels; ab einer Woche das Datum. */
export function relativeTime(iso) {
	const then = iso ? new Date(iso).getTime() : NaN
	if (Number.isNaN(then)) return ""
	const diff = Date.now() - then
	const min = Math.round(diff / 60000)
	if (min < 1) return "gerade eben"
	if (min < 60) return `vor ${min} Min.`
	const std = Math.round(min / 60)
	if (std < 24) return `vor ${std} Std.`
	const tage = Math.round(std / 24)
	if (tage === 1) return "gestern"
	if (tage < 7) return `vor ${tage} Tagen`
	return new Date(then).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })
}
