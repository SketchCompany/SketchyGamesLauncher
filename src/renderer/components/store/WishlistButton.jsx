import { useWishlist } from "../../lib/wishlist.jsx"

/**
 * Stern-Button zum Auf-/Absetzen eines Spiels auf die Wunschliste (Port aus der Web-App).
 * Sitzt oft in klickbaren Karten/Links — daher stopPropagation/preventDefault.
 */
export default function WishlistButton({ gameId, variant = "icon", className = "" }) {
	const { has, toggle } = useWishlist()
	const active = has(gameId)

	function onClick(e) {
		e.preventDefault()
		e.stopPropagation()
		toggle(gameId)
	}

	const label = active ? "Von der Wunschliste entfernen" : "Auf die Wunschliste setzen"

	return (
		<button
			type="button"
			className={`wishlist-btn wishlist-btn--${variant}${active ? " is-active" : ""} ${className}`.trim()}
			onClick={onClick}
			aria-pressed={active}
			aria-label={label}
			title={label}
		>
			<span className={`bi ${active ? "bi-star-fill" : "bi-star"}`} aria-hidden="true" />
			{variant === "pill" && <span className="wishlist-btn__text">{active ? "Gemerkt" : "Wunschliste"}</span>}
		</button>
	)
}
