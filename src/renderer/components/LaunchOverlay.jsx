import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { launchOverlayVariants, launchOverlayFadeVariants } from "../lib/motion.js"
import OrbitSpinner from "./OrbitSpinner.jsx"

// Bildschirmfüllender Startbildschirm: der Glas-Filter wächst als Kreis aus dem geklickten Button.
// `origin` = Buttonmitte in Fensterkoordinaten, `title` = Anzeigename des Spiels.
// `onDismiss` ist die Sicherheitsklappe (Esc/Klick) — ohne sie bliebe das Overlay stehen, wenn ein
// Spiel gar kein Fenster öffnet und der Launcher deshalb nie den Fokus verliert.
export default function LaunchOverlay({ title, origin, onDismiss }) {
	const reduced = useReducedMotion()
	const [showHint, setShowHint] = useState(false)

	// Radius bis zur entferntesten Fensterecke — nur beim Öffnen bestimmt; ein Resize während des
	// Starts ist selten genug, um dafür keine Neuberechnung zu rechtfertigen.
	const custom = useMemo(() => {
		const x = origin?.x ?? window.innerWidth / 2
		const y = origin?.y ?? window.innerHeight / 2
		const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
		return { x, y, r }
	}, [origin])

	useEffect(() => {
		const t = setTimeout(() => setShowHint(true), 3000)
		function onKey(e) {
			if (e.key === "Escape") onDismiss?.()
		}
		window.addEventListener("keydown", onKey)
		return () => {
			clearTimeout(t)
			window.removeEventListener("keydown", onKey)
		}
	}, [onDismiss])

	return (
		<motion.div
			className="fixed inset-0 z-[1050] flex cursor-default flex-col items-center justify-center gap-7 bg-bg-0/60 backdrop-blur-[32px] backdrop-saturate-150"
			custom={custom}
			variants={reduced ? launchOverlayFadeVariants : launchOverlayVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			onClick={onDismiss}
			role="status"
			aria-live="polite"
		>
			{/* Wortmarke wie im Header (AppShell), nur größer — ohne das BETA-Badge, das hier unruhig wirkt. */}
			<div className="flex select-none items-center gap-3">
				<img src="/img/app.png" width={40} height={40} alt="" className="rounded" />
				<span className="font-display text-3xl font-bold tracking-tight text-text-primary">
					Sketchy Games Launcher
				</span>
			</div>

			<OrbitSpinner size={112} />

			<p className="m-0 select-none text-center text-lg text-text-secondary">
				<span className="font-bold text-text-primary">{title}</span> wird gestartet…
			</p>

			<motion.span
				className="absolute bottom-8 select-none text-sm text-text-muted"
				initial={{ opacity: 0 }}
				animate={{ opacity: showHint ? 1 : 0 }}
				transition={{ duration: 0.4 }}
			>
				Esc zum Schließen
			</motion.span>
		</motion.div>
	)
}
