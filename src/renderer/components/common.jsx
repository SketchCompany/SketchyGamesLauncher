// Reine Daten-Helfer für Store-Items (die UI-Komponenten sind in components/store/ gezogen;
// Preis-/Titel-Helfer zusätzlich in components/store/gameUi.js — hier bleiben die Alt-Exporte
// für bestehende Importe erhalten).

/** Titel des Store-Items (Fallback auf `name`). */
export function titleOf(p) {
	return p.title || p.name || "Unbenannt"
}

/** Cover-URL: thumbnail, sonst der erste Screenshot. */
export function coverFor(p) {
	return p.thumbnail || (Array.isArray(p.screenshots) && p.screenshots[0]) || null
}

/** Effektiver Preis in Cent (price hat Vorrang, sonst basePrice). 0 = kostenlos. */
export function effectivePrice(p) {
	if (typeof p.price === "number") return p.price
	return p.basePrice || 0
}

/** Cent → "Gratis" / "x,xx €". */
export function formatPrice(cents) {
	if (!cents || cents <= 0) return "Gratis"
	return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

/** Anzeigename der aktuellen Plattform (für "Nicht verfügbar für …"-Hinweise). */
export function platformName() {
	const p = navigator.platform || ""
	if (/mac/i.test(p)) return "macOS"
	if (/win/i.test(p)) return "Windows"
	return "Linux"
}

/** onError-Handler für Cover-<img>: blendet kaputte Bilder aus. */
export function hideBrokenImg(e) {
	e.currentTarget.style.display = "none"
}
