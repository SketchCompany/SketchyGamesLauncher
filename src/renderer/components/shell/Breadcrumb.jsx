import { Fragment } from "react"
import { Link, useLocation } from "react-router-dom"

/**
 * Brotkrumen-Leiste im Header, direkt neben dem Home-Icon (ersetzt den früheren BackButton
 * und bringt die alte Breadcrumb-Leiste zurück). Die Segmente werden aus dem Pfad abgeleitet;
 * für die Produktseite (/store/:id) wird der Titel aus dem Router-State genommen, sonst die ID.
 */
const LABELS = {
	store: "Store",
	library: "Bibliothek",
	downloads: "Downloads",
	search: "Suche",
	settings: "Einstellungen",
	account: "Konto",
}

export default function Breadcrumb() {
	const { pathname, state } = useLocation()
	const segs = pathname.split("/").filter(Boolean)
	if (segs.length === 0) return null // Startseite: das Home-Icon genügt.

	const crumbs = segs.map((seg, i) => {
		const to = "/" + segs.slice(0, i + 1).join("/")
		const isProduct = i === 1 && segs[0] === "store"
		const label = isProduct
			? state?.product?.title || decodeURIComponent(seg)
			: LABELS[seg] || decodeURIComponent(seg)
		return { to, label, last: i === segs.length - 1 }
	})

	return (
		<nav
			aria-label="Brotkrumen"
			className="app-no-drag hidden min-w-0 items-center gap-1.5 text-sm font-semibold text-text-secondary md:flex"
		>
			{crumbs.map(c => (
				<Fragment key={c.to}>
					<span aria-hidden="true" className="select-none text-text-muted">›</span>
					{c.last ? (
						<span aria-current="page" className="max-w-[14rem] truncate px-1 py-0.5 text-text-primary">
							{c.label}
						</span>
					) : (
						<Link
							to={c.to}
							className="rounded px-1 py-0.5 transition-colors duration-200 hover:text-neon-green focus-visible:outline-2 focus-visible:outline-neon-green"
						>
							{c.label}
						</Link>
					)}
				</Fragment>
			))}
		</nav>
	)
}
