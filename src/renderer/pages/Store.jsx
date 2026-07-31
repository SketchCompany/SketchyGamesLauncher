import { motion } from "framer-motion"
import { useStore } from "../lib/store.jsx"
import { fadeUp } from "../lib/motion.js"
import { GameGridSkeleton } from "../components/Skeletons.jsx"
import ErrorState from "../components/ErrorState.jsx"
import StoreSearchBar from "../components/store/StoreSearchBar.jsx"
import FeaturedCarousel from "../components/store/FeaturedCarousel.jsx"
import PromoBanner from "../components/store/PromoBanner.jsx"
import GameRow from "../components/store/GameRow.jsx"
import StoreTabs from "../components/store/StoreTabs.jsx"
import CategoryBrowse from "../components/store/CategoryBrowse.jsx"

const byDateDesc = (a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")
const byDateAsc = (a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "")

/**
 * Store-Seite — 1:1-Komposition der Web-App (app/games/page.tsx): Suche, Featured-Hero,
 * Promo-Streifen, Spiele-Reihen, Steam-artige Tabs und Kategorie-Kacheln. Solange /api/store
 * lädt, steht ein Layout-treues Skeleton (kein Voll-Spinner, kein Layout-Sprung).
 */
export default function Store() {
	// Gemeinsamer Store-Cache (einmal geladen, von allen Seiten geteilt) + Refresh/Rate-Limit.
	const { data: store, error, loading, refresh } = useStore()

	// Kopfzeile: Suchleiste (enthält den Refresh-Knopf ganz rechts) — in jedem Zustand sichtbar.
	const topBar = <StoreSearchBar />


	if (error && !store) {
		return (
			<div className="page">
				{topBar}
				<ErrorState error={error} onRetry={refresh} />
			</div>
		)
	}

	// Skeleton beim Erstladen UND beim Aktualisieren (force-Refresh) — so ist das Neuladen
	// sichtbar und es bleiben keine veralteten Inhalte stehen, während frische geladen werden.
	if (!store || loading) {
		return (
			<div className="page">
				{topBar}
				<GameGridSkeleton />
			</div>
		)
	}

	const games = store.games || []
	if (games.length === 0) {
		return (
			<div className="page">
				{topBar}
				<ErrorState
					variant="empty"
					icon="bi-plug"
					title="Noch keine Spiele verfügbar"
					message="Der Katalog ist noch leer. Schau bald wieder vorbei!"
					action={{ label: "Aktualisieren", onClick: refresh }}
				/>
			</div>
		)
	}

	// Dynamische Kategorien der API nach key auflösen; fehlt eine, greift die lokale Ableitung.
	const catByKey = new Map((store.categories || []).map(c => [c.key, c]))
	const fromCat = (key, fallback) => (catByKey.get(key)?.games?.length ? catByKey.get(key).games : fallback)

	const released = games.filter(g => !g.comingSoon)
	const featured = games.filter(g => g.featured)
	const heroGames = featured.length > 0 ? featured : games.slice(0, 5)

	const neu = fromCat("new", [...released].sort(byDateDesc))
	const beliebt = fromCat("populars", [...released].sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0)))
	const bestofweek = fromCat("bestofweek", beliebt)
	const community = fromCat("best_rated", [...released].filter(g => (g.rating ?? 0) > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)))
	const empfohlen = fromCat("suggestions", heroGames)
	const bald = [...games].filter(g => g.comingSoon).sort(byDateAsc)
	const promo = [...neu.slice(0, 2), ...bald.slice(0, 1)]

	const counts = new Map()
	for (const g of games) counts.set(g.category, (counts.get(g.category) ?? 0) + 1)
	const topCategories = Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([cat]) => cat)

	return (
		<motion.div className="page store-page" variants={fadeUp} initial="initial" animate="animate">
			{topBar}

			<FeaturedCarousel games={heroGames} />

			<PromoBanner games={promo} />

			<GameRow title="Empfohlen für dich" icon="bi-stars" games={empfohlen} />
			<GameRow title="Neu im Store" icon="bi-asterisk" games={neu} />
			<GameRow title="Beliebt diese Woche" icon="bi-fire" games={bestofweek} />

			<StoreTabs
				tabs={[
					{ id: "neu", label: "Neu & Angesagt", games: neu },
					{ id: "top", label: "Topseller", games: beliebt },
					{ id: "bald", label: "Bald verfügbar", games: bald },
					{ id: "community", label: "Gratis-Highlights", games: community },
				]}
			/>

			<GameRow title="Community empfiehlt" icon="bi-hand-thumbs-up" games={community} />

			{topCategories.map(cat => (
				<GameRow key={cat} title={cat} icon="bi-tag" games={games.filter(g => g.category === cat)} />
			))}

			<CategoryBrowse games={games} />
		</motion.div>
	)
}
