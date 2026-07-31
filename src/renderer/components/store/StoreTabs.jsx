import { useState } from "react"
import { Link } from "react-router-dom"
import StorePreviewBody from "./StorePreviewBody.jsx"
import WishlistButton from "./WishlistButton.jsx"
import { formatDate } from "./gameUi.js"

const INITIAL_VISIBLE = 10
const STEP = 10
const MAX_EXPANSIONS = 5

/**
 * Steam-artige Tab-Liste („Neu & Angesagt / Topseller / …") mit Listenzeilen links und
 * einer Vorschau-Sidebar rechts, die beim Hover/Fokus einer Zeile aktualisiert (Web-Port).
 */
export default function StoreTabs({ tabs }) {
	const usable = tabs.filter(t => t.games.length > 0)
	const [activeTab, setActiveTab] = useState(0)
	const [previewId, setPreviewId] = useState(null)
	const [expansions, setExpansions] = useState(0)

	if (usable.length === 0) return null

	const tab = usable[Math.min(activeTab, usable.length - 1)]
	const preview = tab.games.find(g => g.id === previewId) ?? tab.games[0]

	const visibleCount = INITIAL_VISIBLE + expansions * STEP
	const visibleGames = tab.games.slice(0, visibleCount)
	const remaining = tab.games.length - visibleGames.length
	const canExpand = remaining > 0 && expansions < MAX_EXPANSIONS

	return (
		<section className="store-tabs">
			<div className="store-tabs__bar" role="tablist" aria-label="Store-Listen">
				{usable.map((t, i) => (
					<button
						key={t.id}
						role="tab"
						aria-selected={i === activeTab}
						className={`store-tabs__tab${i === activeTab ? " active" : ""}`}
						onClick={() => {
							setActiveTab(i)
							setPreviewId(null)
							setExpansions(0)
						}}
					>
						{t.label}
					</button>
				))}
			</div>

			<div className="store-tabs__body">
				<div className="store-tabs__list-wrap">
					<ol className="store-tabs__list">
						{visibleGames.map(game => (
							<li
								key={game.id}
								className={`store-row${preview.id === game.id ? " active" : ""}`}
								onMouseEnter={() => setPreviewId(game.id)}
								onFocus={() => setPreviewId(game.id)}
							>
								<Link to={`/store/${encodeURIComponent(game.id)}`} state={{ product: game }} className="store-row__link">
									<div className="store-row__cover">
										{game.thumbnail && <img src={game.thumbnail} alt={game.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
									</div>
									<div className="store-row__main">
										<p className="store-row__title">{game.title}</p>
										<p className="store-row__sub">{(game.tags ?? [game.category]).slice(0, 4).join(", ")}</p>
										{game.releaseDate && <p className="store-row__date">{game.comingSoon ? "Geplant: " : "Veröffentlicht: "}{formatDate(game.releaseDate)}</p>}
									</div>
								</Link>
								<div className="store-row__side">
									<WishlistButton gameId={game.id} className="store-row__star" />
									<span className="store-row__flag">
										{game.comingSoon ? <span className="badge badge--soon">Bald</span> : game.demo ? <span className="badge badge--demo">Demo</span> : <span className="badge badge--free">Gratis</span>}
									</span>
								</div>
							</li>
						))}
					</ol>
					{canExpand && (
						<button type="button" className="store-tabs__more" onClick={() => setExpansions(e => e + 1)}>
							<span className="bi bi-plus-circle" /> Mehr Spiele anzeigen
							<span className="store-tabs__more-count">noch {remaining}</span>
						</button>
					)}
				</div>

				<aside className="store-tabs__preview store-preview-panel" aria-live="polite">
					<StorePreviewBody game={preview} />
				</aside>
			</div>
		</section>
	)
}
