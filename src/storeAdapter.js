// Store-Adapter: liest den Katalog über die v1-GraphQL-API (POST /v1/catalog/graphql) und liefert
// die neue Form { categories, games } an den Renderer. Der Zugang erfolgt mit der Session (Bearer);
// `owned` kommt pro Nutzer aus der Bibliothek. Ersetzt die frühere REST-GET-/store-Abfrage, die
// eine ganz andere (jetzt entfernte) Datenform hatte.
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
 * Holt den Store für den (per Token identifizierten) Nutzer. `owned` ist damit korrekt gefüllt.
 * @param {string} token Session-Bearer-Token
 * @returns {Promise<{ categories: {key:string,title:string,games:any[]}[], games: any[] }>}
 */
async function getStore(token) {
	const data = await func.graphql(STORE_QUERY, {}, { token })
	const store = data && data.store
	if (!store || !Array.isArray(store.games)) throw new func.ApiError("Store-Antwort ungültig", 502, "BAD_STORE")
	const categories = (store.categories || []).map((c) => ({ key: c.key, title: c.title, games: c.items || [] }))
	return { categories, games: store.games }
}

module.exports = { getStore, STORE_QUERY }
