import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/shadcn/badge"
import CoverImage from "../CoverImage.jsx"
import { kindOf, linkFor, relativeTime } from "./newsKinds.js"
import { cn } from "@/lib/utils"

/**
 * Ein Eintrag aus dem Neuigkeiten-Feed. Einheitliche Karte für alle Arten (Update, Event,
 * Beitrag, Ankündigung, Launcher) — der Feed liefert dafür bereits eine gemeinsame Form.
 *
 * Die ganze Karte ist ein Link, wenn es ein sinnvolles Ziel gibt; sonst bleibt sie ein
 * Artikel ohne Klickfläche, damit kein Klick ins Leere führt.
 */
export default function NewsCard({ item, className }) {
	const kind = kindOf(item)
	const to = linkFor(item)
	const heading = item.title || kind.label

	const inner = (
		<>
			{item.cover ? (
				<div className="relative hidden h-full w-28 shrink-0 overflow-hidden rounded bg-bg-2 sm:block">
					<CoverImage src={item.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
				</div>
			) : (
				<div className="hidden size-14 shrink-0 place-items-center self-start rounded bg-bg-2 sm:grid" aria-hidden="true">
					<i className={cn("bi text-2xl", kind.icon, kind.accent)} />
				</div>
			)}

			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline" className={cn("gap-1.5 font-pixel text-[9px] uppercase tracking-widest", kind.accent)}>
						<i className={cn("bi", kind.icon)} aria-hidden="true" />
						{kind.label}
					</Badge>
					{item.pinned && (
						<Badge variant="outline" className="gap-1.5 font-pixel text-[9px] uppercase tracking-widest text-neon-amber">
							<i className="bi bi-pin-angle-fill" aria-hidden="true" /> Angepinnt
						</Badge>
					)}
					{item.fresh && (
						<Badge variant="outline" className="gap-1.5 font-pixel text-[9px] uppercase tracking-widest text-neon-green">
							<i className="bi bi-check-circle-fill" aria-hidden="true" /> Gerade installiert
						</Badge>
					)}
					{item.version && <span className="font-mono text-xs text-text-muted">v{item.version}</span>}
				</div>

				<h3 className="m-0 line-clamp-2 font-display text-base font-extrabold text-text-primary">{heading}</h3>

				{item.body && <p className="m-0 line-clamp-3 text-sm text-text-secondary">{item.body}</p>}

				<p className="m-0 mt-auto flex flex-wrap items-center gap-x-2 pt-1 text-xs text-text-muted">
					{item.gameTitle && <span className="truncate font-semibold">{item.gameTitle}</span>}
					{item.gameTitle && <span aria-hidden="true">·</span>}
					<time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
				</p>
			</div>
		</>
	)

	const shell = cn(
		"hud-frame flex gap-3.5 border-l-2 p-3.5 transition-[border-color,box-shadow] duration-200",
		kind.ring,
		className,
	)

	if (!to) {
		return <article className={shell}>{inner}</article>
	}
	return (
		<Link
			to={to}
			className={cn(shell, "hover:border-border-strong hover:shadow-[var(--elevation)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-green")}
		>
			{inner}
		</Link>
	)
}
