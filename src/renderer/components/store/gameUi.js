/** Kleine geteilte Helfer der Store-Komponenten (Port aus der Web-App). */

/** Initialen aus dem Titel (max. 2 Zeichen) für den Neon-Platzhalter ohne Cover. */
export function initials(title) {
	const words = String(title || "").replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean)
	if (words.length === 0) return "?"
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
	return (words[0][0] + words[1][0]).toUpperCase()
}

/** Effektiver Preis in Cent (price hat Vorrang, sonst basePrice). 0 = kostenlos. */
export function effectivePrice(g) {
	if (typeof g.price === "number") return g.price
	return g.basePrice || 0
}

/** Cent → "Gratis" / "x,xx €". */
export function formatPrice(cents) {
	if (!cents || cents <= 0) return "Gratis"
	return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

/** ISO-Datum → "12. Jun. 2026" (de-DE, kurz). */
export function formatDate(iso) {
	if (!iso) return ""
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return ""
	return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
}
