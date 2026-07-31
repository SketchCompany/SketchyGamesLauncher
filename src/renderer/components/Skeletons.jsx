/**
 * Wiederverwendbare Skeleton-Loader (aus SketchCompanyReact components/skeletons.tsx portiert,
 * Layout-Klassen in Tailwind übersetzt). Die Basis-Klasse `.skeleton` + Shimmer-Keyframe
 * liegen in styles/app.css. Die Skeletons bilden die echten Layouts nach, damit beim
 * Umschalten auf Inhalt kein Sprung entsteht — nur Bereiche, die wirklich aufs Netz warten,
 * zeigen Skeletons; lokale Inhalte rendern sofort.
 */
import { cn } from "@/lib/utils"

/** Einzelne Platzhalter-Box. */
export function Skeleton({ width, height, radius, className, style }) {
	return (
		<span
			className={cn("skeleton", className)}
			aria-hidden="true"
			style={{ width, height, borderRadius: radius, ...style }}
		/>
	)
}

/** Eine Spiel-Karte (Cover + Titelzeilen), wie im Store-Raster. */
export function GameCardSkeleton() {
	return (
		<div className="flex flex-col gap-2">
			<Skeleton className="aspect-[16/10] w-full rounded-lg" />
			<Skeleton className="h-[0.8em] rounded-md" width="80%" />
			<Skeleton className="h-[0.8em] rounded-md" width="50%" />
		</div>
	)
}

/** Eine horizontale Reihe von Karten (wie GameRow). */
export function GameRowSkeleton({ cards = 5 }) {
	return (
		<div className="flex flex-col gap-4">
			<Skeleton className="h-[1.4em] max-w-55 rounded-md" width="220px" />
			<div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
				{Array.from({ length: cards }).map((_, i) => (
					<GameCardSkeleton key={i} />
				))}
			</div>
		</div>
	)
}

/** Store-Übersicht: Hero-Banner + mehrere Karten-Reihen. */
export function GameGridSkeleton() {
	return (
		<div className="flex flex-col gap-10 py-6" role="status" aria-label="Store wird geladen">
			<Skeleton className="h-[clamp(220px,34vw,420px)] w-full rounded-lg" />
			<GameRowSkeleton />
			<GameRowSkeleton />
			<GameRowSkeleton />
		</div>
	)
}

/** Spiel-Detailseite: Titel, Medien-Bühne, Text/Sidebar. */
export function GameDetailSkeleton() {
	return (
		<div className="flex flex-col gap-5 py-6" role="status" aria-label="Spiel wird geladen">
			<Skeleton className="h-[34px] rounded-md" width="min(60%, 420px)" />
			<Skeleton className="h-[clamp(240px,40vw,460px)] w-full rounded-lg" />
			<div className="grid grid-cols-[2fr_1fr] gap-6 max-md:grid-cols-1">
				<div className="flex flex-col gap-1.5">
					<Skeleton className="h-[0.8em] rounded-md" width="95%" />
					<Skeleton className="h-[0.8em] rounded-md" width="88%" />
					<Skeleton className="h-[0.8em] rounded-md" width="72%" />
					<Skeleton className="h-[0.8em] rounded-md" width="90%" />
				</div>
				<Skeleton className="h-65 w-full rounded-lg" />
			</div>
		</div>
	)
}

/** Formular-/Panel-Skeleton (Konto). */
export function PanelSkeleton({ rows = 3 }) {
	return (
		<div className="flex flex-col gap-4 py-6" role="status" aria-label="Wird geladen">
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
					<Skeleton className="h-[1.1em] rounded-md" width="30%" />
					<Skeleton className="h-[2.2em] rounded-md" width="100%" />
				</div>
			))}
		</div>
	)
}

/** Kleine Kachel (Startseite „Zuletzt gespielt“). */
export function TileSkeleton() {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
			<Skeleton className="size-12 shrink-0 rounded-md" />
			<div className="flex-1">
				<Skeleton className="h-[0.9em] rounded-md" width="60%" />
				<Skeleton className="mt-1.5 h-[0.7em] rounded-md" width="35%" />
			</div>
		</div>
	)
}

/**
 * Neuigkeiten-Karten. Maße bewusst nah an NewsCard, damit beim Umschalten auf die echten
 * Einträge nichts springt.
 */
export function NewsCardSkeleton() {
	return (
		<div className="hud-frame flex gap-3.5 border-l-2 p-3.5">
			<Skeleton className="hidden h-full w-28 shrink-0 rounded sm:block" />
			<div className="flex flex-1 flex-col gap-2">
				<Skeleton className="h-[0.8em] rounded-full" width="90px" />
				<Skeleton className="h-[1em] rounded-md" width="75%" />
				<Skeleton className="h-[0.8em] rounded-md" width="95%" />
				<Skeleton className="h-[0.7em] rounded-md" width="40%" />
			</div>
		</div>
	)
}

export function NewsListSkeleton({ count = 4 }) {
	return (
		<div className="grid gap-3 md:grid-cols-2" role="status" aria-label="Neuigkeiten werden geladen">
			{Array.from({ length: count }).map((_, i) => (
				<NewsCardSkeleton key={i} />
			))}
		</div>
	)
}

/** Bewertungs-/Reviewliste auf der Detailseite. */
export function ReviewsSkeleton({ count = 3 }) {
	return (
		<div className="flex flex-col gap-3" role="status" aria-label="Bewertungen werden geladen">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
					<div className="flex items-center gap-2">
						<Skeleton className="size-8 rounded-full" />
						<Skeleton className="h-[0.9em] rounded-md" width="120px" />
					</div>
					<Skeleton className="h-[0.8em] rounded-md" width="90%" />
					<Skeleton className="h-[0.8em] rounded-md" width="70%" />
				</div>
			))}
		</div>
	)
}
