// Store-Adapter: liest den Katalog über die v1-GraphQL-API (POST /v1/catalog/graphql, Titel/Preis/
// Besitz/Thumbnail) und reichert ihn mit den Build-Infos der Web-App an (`GET WEB_BASE/api/launcher/
// games` → downloadUrl/version/sha256/sizeBytes, gematcht per id). Liefert die neue Form
// { categories, games } an den Renderer. Zugang jeweils mit der Session (Bearer); `owned` pro Nutzer.
const func = require("./functions")
const { webUrl, apiHeaders } = require("./apiBase")

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
 * Holt die Build-Metadaten der Web-App (nur veröffentlichte Spiele MIT echtem Build).
 * Rückgabe: Map id → { downloadUrl(absolut), version, sha256, sizeBytes }. Bei Fehler leere Map
 * (der Store zeigt dann Spiele ohne Download-Button — "kein Build verfügbar").
 * @param {string} token
 * @returns {Promise<Map<string, object>>}
 */
async function fetchBuilds(token) {
	try {
		const res = await fetch(webUrl("/api/launcher/games"), { headers: apiHeaders({ token, json: false }) })
		if (!res.ok) return new Map()
		const body = await res.json().catch(() => null)
		const list = body && Array.isArray(body.games) ? body.games : []
		const map = new Map()
		for (const b of list) {
			if (!b || !b.id) continue
			map.set(b.id, {
				// downloadUrl kommt relativ ("/api/download/games/:id") → auf den Web-Host absolut machen.
				downloadUrl: webUrl(b.downloadUrl || "/api/download/games/" + b.id),
				version: b.version || null,
				sha256: b.sha256 || b.checksum || b.hash || null,
				sizeBytes: b.sizeBytes || null,
			})
		}
		return map
	} catch (err) {
		console.warn("fetchBuilds: konnte Build-Katalog nicht laden:", err.message)
		return new Map()
	}
}

// Mischt die Build-Infos in ein Store-Item (nur wenn ein Build existiert).
function enrich(item, builds) {
	const b = builds.get(item.id)
	if (!b) return item
	return { ...item, downloadUrl: b.downloadUrl, version: b.version, sha256: b.sha256, sizeBytes: b.sizeBytes }
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
