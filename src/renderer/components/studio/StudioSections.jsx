import { useState } from "react"
import { Link } from "react-router-dom"
import StoreCard from "../store/StoreCard.jsx"
import WishlistButton from "../store/WishlistButton.jsx"
import ContentBlocks from "./ContentBlocks.jsx"
import { openExternal } from "../../lib/api.js"

/** Spiele in der angegebenen ID-Reihenfolge auflösen (unbekannte IDs fallen weg). */
function resolveGames(ids, games) {
	const byId = new Map(games.map(g => [g.id, g]))
	return (ids ?? []).map(id => byId.get(id)).filter(Boolean)
}

/** Automatisch befüllte Liste („Beliebteste", „Am besten bewertet", …) aus den Studio-Spielen. */
function generated(source, games, limit = 8) {
	const list = [...games]
	switch (source) {
		case "top-rated":
			list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
			break
		case "newest":
			list.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))
			break
		case "popular":
		case "most-wishlisted":
		default:
			list.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))
			break
	}
	return list.slice(0, limit)
}

function SectionHead({ title, icon }) {
	if (!title) return null
	return (
		<h2 className="section-title studio-section__title">
			{icon && <span className={`bi ${icon}`} aria-hidden="true" />} {title}
		</h2>
	)
}

function GameGrid({ games }) {
	if (games.length === 0) return <p className="studio-section__empty">Noch keine Spiele hier.</p>
	return (
		<div className="studio-section__grid">
			{games.map(g => (
				<StoreCard key={g.id} game={g} />
			))}
		</div>
	)
}

/** Großansicht eines einzelnen Spiels: Medien links, Infos rechts. */
export function SingleGameFeature({ game, variant = "default", mark }) {
	const [active, setActive] = useState(0)
	const images = Array.from(new Set([game.thumbnail, ...(game.screenshots ?? [])].filter(Boolean)))
	const hero = images[active] ?? images[0]

	return (
		<div className={`studio-feature studio-feature--${variant}`}>
			<div className="studio-feature__media">
				<div className="studio-feature__stage">
					{hero ? (
						<img src={hero} alt={game.title} />
					) : (
						<div className={`game-thumb--ph game-thumb--${game.accent ?? "green"}`} aria-hidden="true" />
					)}
					{mark && <span className={`badge ${mark === "demo" ? "badge--demo" : "badge--soon"} studio-feature__mark`}>{mark === "demo" ? "Demo" : "Demnächst"}</span>}
				</div>
				{images.length > 1 && (
					<div className="studio-feature__thumbs">
						{images.slice(0, 5).map((src, i) => (
							<button key={src} type="button" className={`studio-feature__thumb${i === active ? " is-active" : ""}`} onClick={() => setActive(i)} aria-label={`Bild ${i + 1}`}>
								<img src={src} alt="" />
							</button>
						))}
					</div>
				)}
			</div>
			<div className="studio-feature__info">
				<div className="studio-feature__head">
					<h3 className="studio-feature__title">{game.title}</h3>
					{game.rating != null && <span className="studio-feature__rating">{game.rating}% positiv</span>}
				</div>
				<p className="studio-feature__cat">{game.category}</p>
				{(game.description || game.tagline) && <p className="studio-feature__desc">{game.description ?? game.tagline}</p>}
				{game.tags && game.tags.length > 0 && <p className="studio-feature__tags">{game.tags.slice(0, 6).join(" · ")}</p>}
				<div className="studio-feature__actions">
					<Link to={`/store/${encodeURIComponent(game.id)}`} state={{ product: game }} className="btn btn--primary">
						Spiel ansehen
					</Link>
					<WishlistButton gameId={game.id} />
				</div>
			</div>
		</div>
	)
}

/** Mehrere Spiele groß, eins nach dem anderen; Pfeile außen. */
function GameCarousel({ games }) {
	const [i, setI] = useState(0)
	if (games.length === 0) return null
	const current = games[Math.min(i, games.length - 1)]
	const go = dir => setI(prev => (prev + dir + games.length) % games.length)

	return (
		<div className="studio-carousel">
			<button type="button" className="studio-carousel__arrow studio-carousel__arrow--left" onClick={() => go(-1)} aria-label="Vorheriges Spiel" disabled={games.length < 2}>
				<span className="bi bi-chevron-left" aria-hidden="true" />
			</button>
			<div className="studio-carousel__stage">
				<SingleGameFeature game={current} variant="spotlight" />
			</div>
			<button type="button" className="studio-carousel__arrow studio-carousel__arrow--right" onClick={() => go(1)} aria-label="Nächstes Spiel" disabled={games.length < 2}>
				<span className="bi bi-chevron-right" aria-hidden="true" />
			</button>
			{games.length > 1 && (
				<div className="studio-carousel__dots">
					{games.map((g, idx) => (
						<button key={g.id} type="button" className={`studio-carousel__dot${idx === i ? " is-active" : ""}`} onClick={() => setI(idx)} aria-label={`Spiel ${idx + 1}`} />
					))}
				</div>
			)}
		</div>
	)
}

/** Rendert einen einzelnen Studio-Abschnitt anhand seines Typs. Port aus der Web-App. */
export default function StudioSectionView({ section, games }) {
	switch (section.type) {
		case "single-game": {
			const game = resolveGames([section.gameId], games)[0]
			if (!game) return null
			return (
				<section className="studio-section">
					<SectionHead title={section.title} />
					<SingleGameFeature game={game} />
				</section>
			)
		}
		case "spotlight": {
			const game = resolveGames([section.gameId], games)[0]
			if (!game) return null
			return (
				<section className="studio-section studio-section--spotlight">
					<SectionHead title={section.title ?? "Spotlight"} icon="bi-star-fill" />
					<SingleGameFeature game={game} variant="spotlight" />
				</section>
			)
		}
		case "highlight-status": {
			const game = resolveGames([section.gameId], games)[0]
			if (!game) return null
			return (
				<section className="studio-section">
					<SectionHead title={section.title} />
					<SingleGameFeature game={game} mark={section.mark} />
				</section>
			)
		}
		case "game-selection":
			return (
				<section className="studio-section">
					<SectionHead title={section.title ?? "Ausgewählte Spiele"} icon="bi-collection" />
					<GameGrid games={resolveGames(section.gameIds, games)} />
				</section>
			)
		case "category": {
			const inCat = games.filter(g => g.category?.toLowerCase() === section.category.toLowerCase())
			return (
				<section className="studio-section">
					<SectionHead title={section.title ?? section.category} icon="bi-tag" />
					<GameGrid games={inCat} />
				</section>
			)
		}
		case "generated":
			return (
				<section className="studio-section">
					<SectionHead title={section.title ?? "Empfohlen"} icon="bi-fire" />
					<GameGrid games={generated(section.source, games, section.limit ?? 8)} />
				</section>
			)
		case "sales":
			return (
				<section className="studio-section studio-section--sale">
					<SectionHead title={section.eventTitle ? `${section.title ?? "Angebote"} · ${section.eventTitle}` : section.title ?? "Angebote"} icon="bi-percent" />
					<GameGrid games={resolveGames(section.gameIds, games)} />
				</section>
			)
		case "carousel":
			return (
				<section className="studio-section">
					<SectionHead title={section.title} />
					<GameCarousel games={resolveGames(section.gameIds, games)} />
				</section>
			)
		case "about-text":
			return (
				<section className="studio-section">
					<SectionHead title={section.title} />
					<ContentBlocks blocks={section.blocks} />
				</section>
			)
		case "video": {
			const src = section.url ?? (section.gameId ? resolveGames([section.gameId], games)[0]?.videos?.[0]?.src : undefined)
			if (!src) return null
			return (
				<section className="studio-section">
					<SectionHead title={section.title} />
					<div className="studio-video">
						{/\.(mp4|webm|ogg)$/i.test(src) ? <video src={src} controls className="studio-video__el" /> : <iframe src={src} className="studio-video__el" title={section.title ?? "Video"} allowFullScreen />}
					</div>
				</section>
			)
		}
		case "image-banner": {
			const img = (
				<div className="studio-banner-block">
					<img src={section.imagePath} alt="" />
				</div>
			)
			return <section className="studio-section">{section.link ? <a href={section.link} onClick={e => { e.preventDefault(); openExternal(section.link) }}>{img}</a> : img}</section>
		}
		case "news":
			return (
				<section className="studio-section">
					<SectionHead title={section.title ?? "Neuigkeiten"} icon="bi-newspaper" />
					<div className="studio-news">
						{section.entries.map((e, i) => (
							<article key={i} className="studio-news__item hud-frame">
								<p className="studio-news__date">{e.date}</p>
								<h3 className="studio-news__heading">{e.heading}</h3>
								<p className="studio-news__body">{e.body}</p>
							</article>
						))}
					</div>
				</section>
			)
		case "heading":
			return (
				<section className="studio-section">
					<h2 className="section-title studio-section__divider">{section.text}</h2>
				</section>
			)
		default:
			return null
	}
}
