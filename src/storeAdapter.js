// Store-Adapter: liest den Katalog über die v1-GraphQL-API (POST /v1/catalog/graphql, Titel/Preis/
// Besitz/Thumbnail) und reichert ihn mit den Build-Infos der API an (`GET /v1/launcher/builds` →
// version/sha256/sizeBytes, gematcht per id). Die eigentliche Download-URL kommt NICHT aus dem
// Katalog, sondern wird pro Spiel lizenzgeprüft und kurzlebig signiert geholt (/v1/store/:id/
// download-url) — siehe src/api.js download(). Liefert { categories, games }; `owned` pro Nutzer.
const func = require("./functions")
const { apiUrl } = require("./apiBase")

// Build-Plattform-Namen der API (windows|mac|linux) ↔ Node process.platform.
const BUILD_PLATFORM = { win32: "windows", darwin: "mac", linux: "linux" }[process.platform]

const ITEM_FIELDS = `
	id title thumbnail category description tagline accent
	demo featured comingSoon releaseDate downloads rating developerSlug developer tags
	screenshots videos media about requirements
	recommendation { percent up down total label }
	basePrice currentDiscount price owned
`
const STORE_QUERY = `query LauncherStore {
	store {
		categories { key title items { ${ITEM_FIELDS} } }
		games { ${ITEM_FIELDS} }
	}
}`

/**
 * Holt die Build-Metadaten der API (nur veröffentlichte Spiele MIT aktuellem Build).
 * Rückgabe: Map id → { hasBuild, version, sha256, sizeBytes }. Bei Fehler leere Map
 * (der Store zeigt dann Spiele ohne Download-Button — "kein Build verfügbar").
 * @param {string} token
 * @returns {Promise<Map<string, object>>}
 */
async function fetchBuilds(token) {
	try {
		// func.get entpackt das v1-Envelope → Array [{ id, buildId, version, sha256, sizeBytes, platform }].
		const list = await func.get("/v1/launcher/builds", { token })
		const map = new Map()
		if (Array.isArray(list)) {
			for (const b of list) {
				if (!b || !b.id) continue
				// Nur Builds für die eigene Plattform — ein Windows-Build ist auf macOS nicht
				// installierbar und darf dort nicht als "verfügbar" erscheinen. Toleriert neben
				// windows|mac|linux auch rohe process.platform-Schreibweisen (win32/darwin).
				if (b.platform && b.platform !== BUILD_PLATFORM && b.platform !== process.platform) continue
				map.set(b.id, { hasBuild: true, version: b.version || null, sha256: b.sha256 || null, sizeBytes: b.sizeBytes || null })
			}
		}
		return map
	} catch (err) {
		console.warn("fetchBuilds: konnte Build-Katalog nicht laden:", err.message)
		return new Map()
	}
}

// Relative Medienpfade (z.B. "/media/games/<id>.svg") gegen die API-Basis absolutisieren —
// die API ist der kanonische Host für Spiel-Cover/Screenshots (GET /media/*). Absolute URLs
// bleiben unverändert (apiUrl reicht sie durch).
function absolutizeMedia(item) {
	const abs = (v) => (typeof v === "string" && v.startsWith("/") ? apiUrl(v) : v)
	const out = { ...item }
	out.thumbnail = abs(out.thumbnail)
	if (Array.isArray(out.screenshots)) out.screenshots = out.screenshots.map(abs)
	if (Array.isArray(out.media)) out.media = out.media.map(abs)
	// Auch Bilder in der ausführlichen Beschreibung (about-Blöcke vom Typ "figure" mit .src) —
	// sonst zeigt die Produktseite nur den Alt-Text, weil relative Pfade gegen die SPA-Origin 404en.
	if (Array.isArray(out.about)) out.about = out.about.map((block) => (block && typeof block.src === "string" ? { ...block, src: abs(block.src) } : block))
	return out
}

// Mischt die Build-Infos in ein Store-Item (nur wenn ein Build existiert). KEINE downloadUrl mehr —
// die wird erst beim Download lizenzgeprüft/signiert geholt; hier nur hasBuild + Integritätsdaten.
function enrich(item, builds) {
	const withMedia = absolutizeMedia(item)
	const b = builds.get(item.id)
	if (!b) return withMedia
	return { ...withMedia, hasBuild: true, version: b.version, sha256: b.sha256, sizeBytes: b.sizeBytes }
}

// Kurzlebiger In-Prozess-Cache: setupBackground() wärmt ihn beim Start vor, sodass die
// Store-Seite meist sofort aus dem Cache rendert (Skeletons erscheinen nur bei Kaltstart).
const STORE_CACHE_TTL_MS = 60 * 1000
let storeCache = null // { data, token, at }

/**
 * Holt den Store für den (per Token identifizierten) Nutzer, angereichert um Build-/Download-Infos.
 * @param {string} token Session-Bearer-Token
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{ categories: {key:string,title:string,games:any[]}[], games: any[] }>}
 */
async function getStore(token, opts = {}) {
	if (!opts.force && storeCache && storeCache.token === token && Date.now() - storeCache.at < STORE_CACHE_TTL_MS) {
		return storeCache.data
	}
	const [data, builds] = await Promise.all([func.graphql(STORE_QUERY, {}, { token }), fetchBuilds(token)])
	const store = data && data.store
	if (!store || !Array.isArray(store.games)) throw new func.ApiError("Store-Antwort ungültig", 502, "BAD_STORE")
	const games = store.games.map((g) => enrich(g, builds))
	const categories = (store.categories || []).map((c) => ({ key: c.key, title: c.title, games: (c.items || []).map((g) => enrich(g, builds)) }))
	const result = { categories, games }
	storeCache = { data: result, token, at: Date.now() }
	return result
}

module.exports = { getStore, fetchBuilds, STORE_QUERY, absolutizeMedia }
