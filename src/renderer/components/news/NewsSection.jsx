import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { get } from "../../lib/api.js"
import { minSettle } from "../../lib/minDelay.js"
import { staggerContainer, staggerItem } from "../../lib/motion.js"
import { NewsListSkeleton } from "../Skeletons.jsx"
import ErrorState from "../ErrorState.jsx"
import NewsCard from "./NewsCard.jsx"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs"

const PREVIEW_COUNT = 4

// Filter-Tabs. „Meine Spiele" meint alles, was an einem Spiel hängt (Updates + Beiträge der
// Entwickler); „Launcher" die Versionshinweise des Launchers selbst.
const FILTERS = [
	{ id: "alle", label: "Alle", match: () => true },
	{ id: "spiele", label: "Meine Spiele", match: n => !!n.gameId },
	{ id: "launcher", label: "Launcher", match: n => n.kind === "launcher" },
]

/**
 * Neuigkeiten auf der Startseite: die vier neuesten Einträge aus /api/news, darüber die Filter,
 * rechts der Weg zur vollständigen Liste. Lädt einmal beim Betreten; die Filter arbeiten rein
 * lokal auf dem geladenen Ausschnitt, damit ein Tabwechsel nicht jedes Mal ans Netz geht.
 */
export default function NewsSection() {
	const [items, setItems] = useState(null) // null = lädt
	const [error, setError] = useState(null)
	const [filter, setFilter] = useState("alle")

	function load(retry = false) {
		setError(null)
		setItems(null)
		const settle = minSettle(retry)
		// Etwas mehr holen als angezeigt wird, damit die Filter nicht sofort ins Leere laufen.
		get("/api/news?limit=20")
			.then(d => settle(() => setItems(Array.isArray(d) ? d : [])))
			.catch(e => settle(() => setError(e)))
	}
	useEffect(() => load(false), [])

	const shown = useMemo(() => {
		if (!items) return []
		const match = (FILTERS.find(f => f.id === filter) || FILTERS[0]).match
		return items.filter(match).slice(0, PREVIEW_COUNT)
	}, [items, filter])

	return (
		<section className="mt-12" aria-labelledby="news-heading">
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<h2 id="news-heading" className="section-title">
					<span className="bi bi-broadcast" aria-hidden="true" /> Neuigkeiten
				</h2>
				<span className="flex-1" />
				{items && items.length > 0 && (
					<Tabs value={filter} onValueChange={setFilter}>
						<TabsList>
							{FILTERS.map(f => (
								<TabsTrigger key={f.id} value={f.id}>
									{f.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				)}
				<Link to="/news" className="game-row__more">
					Alle ansehen <span className="bi bi-chevron-right" aria-hidden="true" />
				</Link>
			</div>

			{error ? (
				<ErrorState variant="inline" error={error} onRetry={() => load(true)} />
			) : items === null ? (
				<NewsListSkeleton />
			) : shown.length === 0 ? (
				<ErrorState
					variant="empty"
					icon="bi-broadcast"
					title={items.length === 0 ? "Noch nichts Neues" : "Nichts in dieser Auswahl"}
					message={
						items.length === 0
							? "Sobald es Updates zu deinen Spielen oder Ankündigungen gibt, stehen sie hier."
							: "Wechsle die Auswahl, um andere Neuigkeiten zu sehen."
					}
				/>
			) : (
				<motion.div className="grid gap-3 md:grid-cols-2" variants={staggerContainer} initial="initial" animate="animate">
					{shown.map(item => (
						<motion.div key={`${item.kind}-${item.id}`} variants={staggerItem}>
							<NewsCard item={item} className="h-full" />
						</motion.div>
					))}
				</motion.div>
			)}
		</section>
	)
}
