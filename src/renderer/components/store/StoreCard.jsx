import { Link, useNavigate } from "react-router-dom"
import CoverImage from "../CoverImage.jsx"
import StoreCardPreview from "./StoreCardPreview.jsx"
import { useStorePreview } from "./useStorePreview.js"
import { initials, effectivePrice, formatPrice } from "./gameUi.js"
import { useWishlist } from "../../lib/wishlist.jsx"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/shadcn/context-menu"

/** Cover (16:9) – echtes Bild, sonst Neon-Platzhalter aus den Initialen. */
export function StoreCover({ game }) {
	if (!game.thumbnail) {
		return (
			<div className={`store-cover game-thumb--ph game-thumb--${game.accent ?? "green"}`} aria-hidden="true">
				<span className="game-thumb__glyph pixel">{initials(game.title)}</span>
			</div>
		)
	}
	return (
		<div className="store-cover">
			<CoverImage src={game.thumbnail} alt={game.title} className="absolute inset-0 h-full w-full object-cover" />
		</div>
	)
}

/** Store-Karte mit Steam-artiger Hover-Vorschau (Port aus der Web-App). */
export default function StoreCard({ game }) {
	const { ref, anchor, open, triggerProps, previewProps } = useStorePreview()
	const navigate = useNavigate()
	const { has, toggle } = useWishlist()
	const developer = game.developer || game.developerSlug

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
			<Link to={`/store/${encodeURIComponent(game.id)}`} state={{ product: game }} className="store-card-link" {...triggerProps}>
				<article ref={ref} className="store-card hud-frame">
					<StoreCover game={game} />
					<div className="store-card__info">
						<span className={`store-card__cat store-card__cat--${game.accent ?? "green"}`}>{game.category}</span>
						<p className="store-card__title">{game.title}</p>
						{developer && (
							<p className="store-card__dev">
								<span className="bi bi-building" aria-hidden="true" /> {developer}
							</p>
						)}
						<div className="store-card__footer">
							{game.comingSoon ? (
								<span className="badge badge--soon">Bald</span>
							) : game.owned ? (
								<span className="badge badge--free" title="In deiner Bibliothek">
									<span className="bi bi-check-circle" aria-hidden="true" /> In Bibliothek
								</span>
							) : effectivePrice(game) > 0 ? (
								<span className="badge badge--price">
									{game.currentDiscount ? <span className="badge__discount">−{game.currentDiscount}%</span> : null} {formatPrice(effectivePrice(game))}
								</span>
							) : (
								<span className="badge badge--free">Gratis</span>
							)}
						</div>
					</div>
				</article>
			</Link>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem onSelect={() => navigate(`/store/${encodeURIComponent(game.id)}`)}>
						<i className="bi bi-box-arrow-up-right" aria-hidden="true" /> Im Store öffnen
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => toggle(game.id)}>
						<i className={`bi ${has(game.id) ? "bi-star-fill" : "bi-star"}`} aria-hidden="true" /> {has(game.id) ? "Von Wunschliste entfernen" : "Auf die Wunschliste"}
					</ContextMenuItem>
					{game.developerSlug && (
						<>
							<ContextMenuSeparator />
							<ContextMenuItem onSelect={() => navigate(`/studio/${encodeURIComponent(game.developerSlug)}`)}>
								<i className="bi bi-building" aria-hidden="true" /> Entwickler ansehen
							</ContextMenuItem>
						</>
					)}
				</ContextMenuContent>
			</ContextMenu>
			{anchor && <StoreCardPreview game={game} anchor={anchor} open={open} {...previewProps} />}
		</>
	)
}
