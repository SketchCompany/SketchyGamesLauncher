// Store-Adapter: liest den Katalog über die v1-GraphQL-API (POST /v1/catalog/graphql, Titel/Preis/
// Besitz/Thumbnail) und reichert ihn mit den Build-Infos der API an (`GET /v1/launcher/builds` →
// version/sha256/sizeBytes, gematcht per id). Die eigentliche Download-URL kommt NICHT aus dem
// Katalog, sondern wird pro Spiel lizenzgeprüft und kurzlebig signiert geholt (/v1/store/:id/
// download-url) — siehe src/api.js download(). Liefert { categories, games }; `owned` pro Nutzer.
const func = require("./functions")

const ITEM_FIELDS = `
	id title thumbnail category description tagline accent
	demo featured comingSoon releaseDate downloads rating developerSlug
	screenshots media
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
				map.set(b.id, { hasBuild: true, version: b.version || null, sha256: b.sha256 || null, sizeBytes: b.sizeBytes || null })
			}
		}
		return map
	} catch (err) {
		console.warn("fetchBuilds: konnte Build-Katalog nicht laden:", err.message)
		return new Map()
	}
}

// Mischt die Build-Infos in ein Store-Item (nur wenn ein Build existiert). KEINE downloadUrl mehr —
// die wird erst beim Download lizenzgeprüft/signiert geholt; hier nur hasBuild + Integritätsdaten.
function enrich(item, builds) {
	const b = builds.get(item.id)
	if (!b) return item
	return { ...item, hasBuild: true, version: b.version, sha256: b.sha256, sizeBytes: b.sizeBytes }
}

/**
 * Holt den Store für den (per Token identifizierten) Nutzer, angereichert um Build-/Download-Infos.
 * @param {string} token Session-Bearer-Token
 * @returns {Promise<{ categories: {key:string,title:string,games:any[]}[], games: any[] }>}
 */
async function getStore(token) {
	const [data, builds] = await Promise.all([func.graphql(STORE_QUERY, {}, { token }), fetchBuilds(token)])
	const store = data && data.store
	if (!store || !Array.isArray(store.games)) throw new func.ApiError("Store-Antwort ungültig", 502, "BAD_STORE")
	const games = store.games.map((g) => enrich(g, builds))
	const categories = (store.categories || []).map((c) => ({ key: c.key, title: c.title, games: (c.items || []).map((g) => enrich(g, builds)) }))
	return { categories, games }
}

module.exports = { getStore, STORE_QUERY }
