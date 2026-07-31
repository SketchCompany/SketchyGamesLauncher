import { useEffect, useState } from "react"
import { useStore } from "../../lib/store.jsx"
import { cn } from "@/lib/utils"

/**
 * Refresh-Knopf für die Store-Seite. Erzwingt ein Neuladen des Katalogs (server: ?force=1)
 * über den geteilten StoreProvider. Der Provider setzt nur eine kurze Debounce-Sperre durch;
 * hier wird deren Restzeit heruntergezählt und der Knopf so lange deaktiviert.
 */
export default function RefreshButton({ compact = false }) {
	const { refresh, loading, cooldownUntil } = useStore()
	const [now, setNow] = useState(() => Date.now())

	const cooling = now < cooldownUntil

	// Nur ticken, solange der kurze Cooldown aktiv ist.
	useEffect(() => {
		if (!cooling) return
		const t = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(t)
	}, [cooling])

	const disabled = loading || cooling
	let label = "Aktualisieren"
	let title = "Store neu laden"

	if (cooling) {
		const secs = Math.max(1, Math.ceil((cooldownUntil - now) / 1000))
		label = `Warte ${secs} s`
		title = `Erst in ${secs} s wieder aktualisierbar.`
	}

	return (
		<button
			type="button"
			className={cn("cta cta-secondary store-refresh", compact && "store-search__refresh")}
			onClick={refresh}
			disabled={disabled}
			title={title}
			aria-label={title}
		>
			<span className={cn("bi bi-arrow-clockwise inline-block", loading && "animate-spin")} aria-hidden="true" /> {label}
		</button>
	)
}
