/**
 * Reine Filter-/Sortier-Logik der Suche (Port aus SketchCompanyReact lib/search-data.ts).
 * Im Launcher kommt die Datengrundlage zur Laufzeit aus /api/store (statt der statischen
 * demoGames) — deshalb nehmen die Facetten-Helfer hier die Spieleliste als Parameter.
 */

function distinctSorted(values) {
	return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "de"))
}

export function getCategories(games) {
	return distinctSorted(games.map(g => g.category))
}
export function getDevelopers(games) {
	return distinctSorted(games.map(g => g.developer || g.developerSlug || ""))
}
export function getCategoryCounts(games) {
	const counts = {}
	for (const g of games) counts[g.category] = (counts[g.category] ?? 0) + 1
	return counts
}

// Kuratierte, thematische Tag-Gruppen (Anzeigereihenfolge im Akkordeon).
const CURATED_TAG_GROUPS = [
	{
		label: "Genre",
		tags: ["Action", "Adventure", "Platformer", "Puzzle", "Racing", "Roguelike", "Roguelite", "Simulation", "Strategie", "Horror", "Casual", "Shoot 'em up", "Bullet Hell", "Bullet Heaven", "Tower Defense", "Dungeon Crawler", "Fighting", "Survival"],
	},
	{ label: "Spielmodus", tags: ["Singleplayer", "Multiplayer", "Koop", "Lokaler Multiplayer", "Party"] },
	{ label: "Stimmung", tags: ["Cozy", "Entspannend", "Atmosphärisch", "Story-reich", "Mystery"] },
	{ label: "Stil & Optik", tags: ["Pixel-Art", "Minimalistisch", "Synthwave"] },
	{
		label: "Mechanik & Tempo",
		tags: ["Arcade", "Präzision", "Hardcore", "Permadeath", "Rundenbasiert", "Taktik", "Hex-Grid", "Top-Down", "Physik", "Crafting", "Aufbau", "Management", "Items", "Bestzeiten", "Logik", "Stealth", "Erkundung", "Rhythmus", "Musik", "Mechs"],
	},
]

function popularTags(games, limit = 8) {
	const counts = new Map()
	for (const g of games) for (const t of g.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
		.slice(0, limit)
		.map(([tag]) => tag)
}

/** Geordnete Tag-Gruppen: „Beliebt“ → kuratierte Gruppen → „Weitere“. */
export function getTagGroups(games) {
	const allTags = distinctSorted(games.flatMap(g => g.tags ?? []))
	const existing = new Set(allTags)
	const groups = []

	const beliebt = popularTags(games).filter(t => existing.has(t))
	if (beliebt.length > 0) groups.push({ label: "Beliebt", tags: beliebt })

	const curatedSet = new Set()
	for (const group of CURATED_TAG_GROUPS) {
		const tags = group.tags.filter(t => existing.has(t))
		tags.forEach(t => curatedSet.add(t))
		if (tags.length > 0) groups.push({ label: group.label, tags })
	}

	const leftover = allTags.filter(t => !curatedSet.has(t))
	if (leftover.length > 0) groups.push({ label: "Weitere", tags: leftover })

	return groups
}

export const SORT_OPTIONS = [
	{ value: "relevanz", label: "Relevanz" },
	{ value: "neu", label: "Neueste zuerst" },
	{ value: "downloads", label: "Beliebteste zuerst" },
	{ value: "rating", label: "Beste Bewertung" },
	{ value: "name", label: "Name (A–Z)" },
]

export function parseSort(value) {
	const allowed = ["relevanz", "name", "downloads", "rating", "neu"]
	return allowed.includes(value) ? value : "relevanz"
}

function haystack(game) {
	return [game.title, game.tagline, game.description, game.developer || game.developerSlug, game.category, ...(game.tags ?? [])]
		.filter(Boolean)
		.join(" ")
		.toLowerCase()
}

/** Gewichtete Relevanz pro Suchbegriff – Titel/Entwickler zählen mehr als die Beschreibung. */
function relevanceScore(game, terms) {
	if (terms.length === 0) return 0
	const title = (game.title || "").toLowerCase()
	const dev = (game.developer || game.developerSlug || "").toLowerCase()
	const tags = (game.tags ?? []).map(t => t.toLowerCase())
	const cat = (game.category || "").toLowerCase()
	const text = `${game.tagline ?? ""} ${game.description ?? ""}`.toLowerCase()

	let score = 0
	for (const term of terms) {
		if (title === term) score += 30
		else if (title.startsWith(term)) score += 16
		else if (title.includes(term)) score += 10
		if (dev.includes(term)) score += 6
		if (tags.some(t => t.includes(term))) score += 4
		if (cat.includes(term)) score += 4
		if (text.includes(term)) score += 2
	}
	return score
}

const byName = (a, b) => (a.title || "").localeCompare(b.title || "", "de")
const byDownloads = (a, b) => (b.downloads ?? 0) - (a.downloads ?? 0)
const byRating = (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
const byDateDesc = (a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")

/** Wendet alle Filter + die gewählte Sortierung an (reine Funktion, wie im Web). */
export function filterGames(games, filters) {
	const terms = (filters.q ?? "")
		.toLowerCase()
		.split(/\s+/)
		.map(t => t.trim())
		.filter(Boolean)
	const activeTags = (filters.tags ?? []).map(t => t.toLowerCase())
	const sort = filters.sortierung ?? "relevanz"

	const filtered = games.filter(game => {
		if (filters.kategorie && game.category !== filters.kategorie) return false
		if (filters.entwickler && (game.developer || game.developerSlug) !== filters.entwickler) return false
		if (activeTags.length > 0) {
			const gameTags = (game.tags ?? []).map(t => t.toLowerCase())
			if (!activeTags.every(t => gameTags.includes(t))) return false
		}
		if (terms.length > 0) {
			const hay = haystack(game)
			if (!terms.every(t => hay.includes(t))) return false
		}
		return true
	})

	if (sort === "name") return [...filtered].sort(byName)
	if (sort === "downloads") return [...filtered].sort(byDownloads)
	if (sort === "rating") return [...filtered].sort(byRating)
	if (sort === "neu") return [...filtered].sort(byDateDesc)

	if (terms.length === 0) return [...filtered].sort(byDownloads)
	return [...filtered]
		.map(game => ({ game, score: relevanceScore(game, terms) }))
		.sort((a, b) => b.score - a.score || byDownloads(a.game, b.game))
		.map(s => s.game)
}
