import { Link } from "react-router-dom"

// Icon + Akzent je Kategorie (Fallback für unbekannte Kategorien) — Port aus der Web-App.
const meta = {
	Racing: { icon: "bi-flag", accent: "cyan" },
	Strategie: { icon: "bi-diagram-3", accent: "green" },
	Platformer: { icon: "bi-arrows-move", accent: "magenta" },
	Action: { icon: "bi-lightning-charge", accent: "amber" },
	Casual: { icon: "bi-cup-hot", accent: "magenta" },
	Roguelike: { icon: "bi-dice-5", accent: "green" },
	Puzzle: { icon: "bi-puzzle", accent: "cyan" },
	Multiplayer: { icon: "bi-people", accent: "amber" },
	Adventure: { icon: "bi-compass", accent: "cyan" },
	Horror: { icon: "bi-eye", accent: "magenta" },
	Simulation: { icon: "bi-sliders", accent: "amber" },
}

export default function CategoryBrowse({ games }) {
	const counts = new Map()
	for (const game of games) counts.set(game.category, (counts.get(game.category) ?? 0) + 1)
	const categories = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

	if (categories.length === 0) return null

	return (
		<section className="category-browse">
			<div className="game-row__head">
				<h2 className="section-title">
					<span className="bi bi-grid-3x3-gap" aria-hidden="true" /> Nach Kategorie stöbern
				</h2>
			</div>
			<div className="category-browse__grid">
				{categories.map(([cat, count]) => {
					const m = meta[cat] ?? { icon: "bi-controller", accent: "green" }
					return (
						<Link
							key={cat}
							to={`/search?kategorie=${encodeURIComponent(cat)}`}
							className={`category-tile game-thumb--${m.accent}`}
							aria-label={`Kategorie ${cat} durchsuchen`}
						>
							<span className={`bi ${m.icon} category-tile__icon`} aria-hidden="true" />
							<span className="category-tile__name">{cat}</span>
							<span className="category-tile__count">{count} {count === 1 ? "Spiel" : "Spiele"}</span>
						</Link>
					)
				})}
			</div>
		</section>
	)
}
