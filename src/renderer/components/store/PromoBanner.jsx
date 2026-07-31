import { Link } from "react-router-dom"
import StoreCardPreview from "./StoreCardPreview.jsx"
import { useStorePreview } from "./useStorePreview.js"

/** Eine Promo-Karte im „Demos & Events“-Streifen – mit Hover-Vorschau (Web-Port). */
function PromoCard({ game }) {
	const { ref, anchor, open, triggerProps, previewProps } = useStorePreview()

	return (
		<>
			<Link to={`/store/${encodeURIComponent(game.id)}`} state={{ product: game }} className="promo-card-link" ref={ref} {...triggerProps}>
				<article className="promo-card">
					<div className="promo-card__cover">
						{game.thumbnail && <img src={game.thumbnail} alt={game.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
						<span className={`promo-card__flag${game.comingSoon ? " promo-card__flag--soon" : ""}`}>{game.comingSoon ? "Bald" : "Neu"}</span>
					</div>
					<div className="promo-card__info">
						<p className="promo-card__title">{game.title}</p>
						<span className="badge badge--free">Gratis</span>
					</div>
				</article>
			</Link>
			{anchor && <StoreCardPreview game={game} anchor={anchor} open={open} {...previewProps} />}
		</>
	)
}

/**
 * Arcade-Promo-Streifen („Demos & Events") — Web-Port; der Launcher-CTA führt hier
 * in die Suche statt zur Launcher-Downloadseite.
 */
export default function PromoBanner({ games }) {
	if (games.length === 0) return null

	return (
		<section className="promo-banner hud-frame">
			<div className="promo-banner__lead">
				<p className="promo-banner__eyebrow pixel">Demos &amp; Events</p>
				<h2 className="promo-banner__headline">Entdecke kostenlos spielbare Indie-Demos</h2>
				<p className="promo-banner__sub">Jede Woche frisch geprüft und direkt startklar in deiner Bibliothek.</p>
				<Link to="/search" className="cta cta-secondary">
					<span className="bi bi-search" aria-hidden="true" /> Alle Spiele durchsuchen
				</Link>
			</div>
			<div className="promo-banner__cards">
				{games.slice(0, 3).map(game => (
					<PromoCard game={game} key={game.id} />
				))}
			</div>
		</section>
	)
}
