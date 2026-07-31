import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import WishlistButton from "./WishlistButton.jsx"
import { initials } from "./gameUi.js"

/**
 * Gemeinsamer Inhalt der Spiel-Detail-Vorschau (Media + Body) — Port aus der Web-App.
 * Wird vom schwebenden Hover-Fenster UND der Sticky-Sidebar der Store-Tabs gerendert.
 * Enthält jetzt auch einen „Entwickler ansehen"-Link zur Studio-Seite (/studio/:slug).
 */
export default function StorePreviewBody({ game }) {
	const [index, setIndex] = useState(0)

	const tags = (game.tags ?? []).filter(tag => tag.toLowerCase() !== game.category?.toLowerCase()).slice(0, 4)
	const images = Array.from(new Set([game.thumbnail, ...(game.screenshots ?? [])].filter(Boolean)))
	const description = game.description ?? game.tagline

	useEffect(() => setIndex(0), [game.id])

	// Automatische Bild-Rotation (außer bei reduzierter Bewegung).
	useEffect(() => {
		if (images.length < 2) return
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const id = window.setInterval(() => setIndex(i => (i + 1) % images.length), 1300)
		return () => window.clearInterval(id)
	}, [images.length])

	const developer = game.developer || game.developerSlug

	return (
		<>
			<div className="store-preview__media">
				{images.length > 0 ? (
					images.map((src, i) => (
						<img
							key={src}
							src={src}
							alt=""
							className="absolute inset-0 h-full w-full object-cover"
							style={{ opacity: i === index ? 1 : 0 }}
							aria-hidden="true"
						/>
					))
				) : (
					<div className={`store-preview__ph game-thumb--ph game-thumb--${game.accent ?? "green"}`} aria-hidden="true">
						<span className="game-thumb__glyph pixel">{initials(game.title)}</span>
					</div>
				)}
			</div>
			<div className="store-preview__body">
				{/* Kategorie steht — wie bei den Standard-Store-Karten — ÜBER Name und Bewertung. */}
				{game.category && <span className={`store-card__cat store-card__cat--${game.accent ?? "green"}`}>{game.category}</span>}
				<div className="store-preview__head">
					<p className="store-preview__title">{game.title}</p>
					{game.rating != null && <span className="store-preview__rating">{game.rating}% positiv</span>}
				</div>
				{developer && <p className="store-preview__dev">{developer}</p>}
				{description && <p className="store-preview__desc">{description}</p>}
				{tags.length > 0 && (
					<div className="store-preview__meta">
						<span className="store-preview__tags">{tags.join(" · ")}</span>
					</div>
				)}
				<div className="store-preview__actions">
					{/* Zeile 1: „Spiel ansehen" füllt die Breite, Stern rechts daneben. */}
					<Link to={`/store/${encodeURIComponent(game.id)}`} state={{ product: game }} className="btn btn--primary store-preview__cta store-preview__cta--primary">
						Spiel ansehen
					</Link>
					<WishlistButton gameId={game.id} />
					{/* Zeile 2: „Entwickler ansehen" über die volle Breite. */}
					{game.developerSlug && (
						<Link to={`/studio/${encodeURIComponent(game.developerSlug)}`} className="btn btn--ghost store-preview__cta store-preview__cta--dev">
							Entwickler ansehen
						</Link>
					)}
				</div>
			</div>
		</>
	)
}
