import { useEffect, useRef, useState } from "react"
import { NavLink, Link, useNavigate, useLocation, useOutlet } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import NotificationsPopover from "./NotificationsPopover.jsx"
import Breadcrumb from "./Breadcrumb.jsx"
import PageContextMenu from "./PageContextMenu.jsx"
import ScrollToTop from "../ScrollToTop.jsx"
import { get, send, openExternal } from "../../lib/api.js"
import { useNotify } from "../../lib/notifications.jsx"
import { useOffline } from "../../lib/offline.jsx"
import { toastedIds, removeServerNotification } from "../../lib/notificationsClient.js"
import { pageVariants } from "../../lib/motion.js"
import { cn } from "@/lib/utils"

// Primäre Navigations-Icons — rechts im Header (Home-Icon + Brotkrumen bleiben links).
// Reihenfolge wie gewünscht: Store, Suche, Downloads, Bibliothek (Controller).
const NAV_ITEMS = [
	{ to: "/store", label: "Store", icon: "bi-bag" },
	{ to: "/search", label: "Suche", icon: "bi-search" },
	{ to: "/downloads", label: "Downloads", icon: "bi-download" },
	{ to: "/library", label: "Bibliothek", icon: "bi-controller" },
]

// macOS: Die Ampel-Buttons des Fensters liegen oben links ÜBER dem Header (titleBarOverlay,
// index.js) — der Inhalt weicht ihnen mit zusätzlichem Innenabstand aus.
const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform)

// Gemeinsame Basisklasse aller Header-Icons. `app-no-drag` ist zwingend: der <header> ist eine
// Electron-Drag-Region (app-drag), ohne diese Ausnahme schluckt sie Klicks auf die Icons.
// Etwas größer als zuvor (size-11 statt size-10, text-xl statt text-lg).
// WICHTIG: className MUSS ein String sein (kein NavLink-Callback). Der Radix-<TooltipTrigger asChild>-
// Slot serialisiert eine className-Funktion sonst zu Müll → die Icons verlieren alle Klassen
// (kein Abstand/Hover/klickbar). Deshalb hier die Aktiv-Variante über die von NavLink automatisch
// gesetzte `active`-Klasse (`[&.active]:…`) statt über den Callback.
const ICON_BASE =
	"app-no-drag relative grid size-11 cursor-pointer place-items-center rounded text-xl text-text-secondary transition-colors duration-200 hover:bg-accent hover:text-neon-green focus-visible:outline-2 focus-visible:outline-neon-green [&.active]:text-neon-green [&.active]:bg-accent"

// Wie ICON_BASE, aber OHNE Neon-Grün: Hover/aktiv nur mit Hintergrund-Highlight (text-text-primary
// statt neon-green). Für die Glocke gewünscht — sie soll nur „gehighlightet“ werden, nicht grün.
const ICON_NO_GREEN =
	"app-no-drag relative grid size-11 cursor-pointer place-items-center rounded text-xl text-text-secondary transition-colors duration-200 hover:bg-accent hover:text-text-primary focus-visible:outline-2 focus-visible:outline-neon-green"

// Vor/Zurück-Pfeile rechts neben dem Home-Icon, wie im Browser — dauerhaft sichtbar.
// Kleine Hitbox, Highlight-only (kein Grün). navigate(-1)/(1) sind an den Enden harmlose No-Ops.
function NavArrows() {
	const navigate = useNavigate()
	const btn =
		"app-no-drag grid size-6 cursor-pointer place-items-center rounded text-sm text-text-secondary transition-colors duration-200 hover:bg-accent hover:text-text-primary focus-visible:outline-2 focus-visible:outline-neon-green"
	return (
		<div className="flex shrink-0 items-center gap-0.5">
			<button type="button" aria-label="Zurück" className={btn} onClick={() => navigate(-1)}>
				<i className="bi bi-chevron-left" aria-hidden="true" />
			</button>
			<button type="button" aria-label="Vorwärts" className={btn} onClick={() => navigate(1)}>
				<i className="bi bi-chevron-right" aria-hidden="true" />
			</button>
		</div>
	)
}

function HeaderIconLink({ to, label, icon, badge, disabled }) {
	// Offlinemodus: Online-Icons sichtbar aber deaktiviert (ausgegraut, nicht klickbar, Hinweis).
	if (disabled) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span aria-label={label} aria-disabled="true" className={cn(ICON_BASE, "pointer-events-none cursor-not-allowed opacity-40")}>
						<i className={`bi ${icon}`} aria-hidden="true" />
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom">{label} — nur online verfügbar</TooltipContent>
			</Tooltip>
		)
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<NavLink to={to} aria-label={label} className={ICON_BASE}>
					<i className={`bi ${icon}`} aria-hidden="true" />
					{badge > 0 && (
						<span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-neon-green px-1 font-pixel text-[8px] leading-4 text-black">
							{badge > 9 ? "9+" : badge}
						</span>
					)}
				</NavLink>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	)
}

function Header({ notifs, unreadCount, bellOpen, setBellOpen, onClearNotifs, onRemoveNotif, downloadCount }) {
	const [scrolling, setScrolling] = useState(false)
	const { offline } = useOffline()
	// Im Offlinemodus deaktiviert. Downloads gehört dazu: Herunterladen und Aktualisieren brauchen
	// den Server — die Warteschlange wird offline ohnehin nicht mehr abgefragt (siehe AppShell-Polling).
	const ONLINE_NAV = new Set(["/store", "/search", "/downloads"])
	useEffect(() => {
		const onScroll = () => setScrolling(window.scrollY > 30)
		window.addEventListener("scroll", onScroll)
		return () => window.removeEventListener("scroll", onScroll)
	}, [])

	return (
		<header
			className={cn(
				"sticky top-0 z-100 flex min-h-(--header-h) items-center justify-between gap-3 px-[5%] transition-all duration-200",
				scrolling ? "border-b border-border bg-bg-0/70 backdrop-blur-lg" : "border-b border-transparent bg-transparent",
			)}
			style={IS_MAC ? { paddingLeft: "76px" } : undefined}
		>
			{/* Drag-Ebene HINTER dem Inhalt: leere Header-Flächen (und der pointer-events-none-Brand)
			    ziehen das Fenster, während die interaktiven Icons NICHT in einer Drag-Region liegen —
			    damit sind sie zuverlässig klickbar (Workaround für das flakige per-Icon no-drag). */}
			<div className="app-drag absolute inset-0 z-0" aria-hidden="true" />

			{/* Links: Home-Icon + Brotkrumen (Position unverändert). Auf Nicht-macOS leicht nach
			    links gezogen, damit das Home-Icon bündig mit dem Seiteninhalt sitzt; auf macOS nicht,
			    um die Ampel-Buttons nicht zu überlappen. */}
			<div className={cn("relative z-10 flex min-w-0 items-center gap-1", !IS_MAC && "-ml-2")}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Link to="/" aria-label="Startseite" className={ICON_BASE}>
							<i className="bi bi-house-door" aria-hidden="true" />
						</Link>
					</TooltipTrigger>
					<TooltipContent side="bottom">Startseite</TooltipContent>
				</Tooltip>

				<NavArrows />

				<Breadcrumb />
			</div>

			{/* Mitte: Logo + App-Name, exakt zentriert unabhängig von den Seiten */}
			<div className="pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 select-none items-center gap-2 max-lg:hidden">
				<img src="/img/app.png" width={28} height={28} alt="" className="rounded" />
				<span className="font-display text-xl font-bold tracking-tight text-text-primary">
					Sketchy Games Launcher
					<span className="ml-2 align-middle font-pixel text-[8px] tracking-widest text-neon-green">BETA</span>
				</span>
			</div>

			{/* Rechts: Navigation (Store, Suche, Downloads, Bibliothek) | Glocke, Einstellungen, Konto */}
			<nav className="relative z-10 -mr-2 flex shrink-0 items-center gap-1" aria-label="Navigation">
				{NAV_ITEMS.map(item => (
					<HeaderIconLink key={item.to} {...item} badge={item.to === "/downloads" ? downloadCount : 0} disabled={offline && ONLINE_NAV.has(item.to)} />
				))}
				<span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
				{offline ? (
					// Offlinemodus: Glocke sichtbar aber deaktiviert (keine Online-Benachrichtigungen).
					<Tooltip>
						<TooltipTrigger asChild>
							<span aria-label="Benachrichtigungen" aria-disabled="true" className={cn(ICON_NO_GREEN, "pointer-events-none cursor-not-allowed opacity-40")}>
								<i className="bi bi-bell" aria-hidden="true" />
							</span>
						</TooltipTrigger>
						<TooltipContent side="bottom">Benachrichtigungen — nur online verfügbar</TooltipContent>
					</Tooltip>
				) : (
					<NotificationsPopover open={bellOpen} onOpenChange={setBellOpen} items={notifs} onClear={onClearNotifs} onRemove={onRemoveNotif}>
						<button
							aria-label={`Benachrichtigungen${unreadCount ? ` (${unreadCount} neu)` : ""}`}
							className={cn(ICON_NO_GREEN, bellOpen && "bg-accent text-text-primary")}
						>
							<i className="bi bi-bell" aria-hidden="true" />
							{unreadCount > 0 && (
								<span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-neon-green px-1 font-pixel text-[8px] leading-4 text-black">
									{unreadCount > 9 ? "9+" : unreadCount}
								</span>
							)}
						</button>
					</NotificationsPopover>
				)}
				<HeaderIconLink to="/settings" label="Einstellungen" icon="bi-gear" />
				<HeaderIconLink to="/account" label="Konto" icon="bi-person-circle" disabled={offline} />
			</nav>
		</header>
	)
}

export default function AppShell() {
	const [bellOpen, setBellOpen] = useState(false)
	const [notifs, setNotifs] = useState([])
	const [downloadCount, setDownloadCount] = useState(0)
	// Offener Datenleck-Hinweis: bestehende Sitzungen werden bei einem Treffer bewusst nicht
	// beendet, deshalb hier ein Warnband statt eines Rauswurfs (der Zwang kommt beim nächsten Login).
	const [leakOpen, setLeakOpen] = useState(false)
	const location = useLocation()
	const navigate = useNavigate()
	const notify = useNotify()
	const { offline, setOffline } = useOffline()
	const seenRef = useRef(null) // Set der bereits gesehenen Notification-ids (null = noch nicht seeded)
	// useOutlet() (statt <Outlet/>): das aufgelöste Element ist an die aktuelle Location
	// gebunden — so behält die ausblendende Seite bei mode="wait" ihren alten Inhalt.
	const outlet = useOutlet()

	// Benachrichtigungen + aktive Downloads im Hintergrund aktuell halten (leichtes Polling).
	// Neue, serverseitig erzeugte Benachrichtigungen (z.B. „Installation fertig") werden dabei
	// EINMAL zusätzlich als Toast gezeigt — gleiche Optik wie die Glocke.
	useEffect(() => {
		if (offline) return // Offlinemodus: keine Benachrichtigungs-Abfrage/Toasts, keine Download-Badges.
		let alive = true
		const applyNotifs = (d) => {
			if (!alive || !Array.isArray(d)) return
			if (seenRef.current === null) {
				// Erster Poll: vorhandenes als „gesehen" markieren (kein Backlog-Toast beim Start).
				seenRef.current = new Set(d.map(n => n.id))
			} else {
				for (const n of d) {
					if (seenRef.current.has(n.id) || toastedIds.has(n.id)) continue
					seenRef.current.add(n.id)
					notify(n.title, n.message, n.type, n.actions?.length ? 12000 : 8000, { actions: n.actions, serverId: n.id })
				}
			}
			setNotifs(d)
		}
		const loadNotifs = () => get("/api/notifications").then(applyNotifs).catch(() => {})
		const loadDownloads = () => get("/api/downloads").then(d => { if (alive) setDownloadCount(Array.isArray(d?.downloadQueue) ? d.downloadQueue.length : 0) }).catch(() => {})
		loadNotifs()
		loadDownloads()
		const t1 = setInterval(loadNotifs, 10000)
		const t2 = setInterval(loadDownloads, 10000)
		// Sofort neu laden, wenn der Client eine Benachrichtigung entfernt/hinzufügt.
		const onChanged = () => loadNotifs()
		window.addEventListener("sgl:notifications-changed", onChanged)
		return () => { alive = false; clearInterval(t1); clearInterval(t2); window.removeEventListener("sgl:notifications-changed", onChanged) }
	}, [notify, offline])

	// Datenleck-Hinweis einmal beim Start prüfen (und nach einem Kontowechsel). Kein Polling:
	// der Zustand ändert sich höchstens einmal am Tag, und die Anfrage geht ans Netz.
	useEffect(() => {
		if (offline) { setLeakOpen(false); return }
		let alive = true
		const check = () => get("/api/account/credential-alert").then(d => { if (alive) setLeakOpen(d?.open === true) }).catch(() => {})
		check()
		window.addEventListener("sgl:session-changed", check)
		return () => { alive = false; window.removeEventListener("sgl:session-changed", check) }
	}, [offline])

	// Glocke geöffnet → alles als gelesen markieren (Badge-Zähler zurücksetzen).
	useEffect(() => {
		if (!bellOpen) return
		if (!notifs.some(n => !n.read)) return
		setNotifs(prev => prev.map(n => (n.read ? n : { ...n, read: true })))
		send("/api/notifications/read", {}).catch(() => {})
	}, [bellOpen]) // eslint-disable-line react-hooks/exhaustive-deps

	const unreadCount = notifs.reduce((a, n) => a + (n.read ? 0 : 1), 0)

	const clearNotifs = () => {
		setBellOpen(false)
		send("/api/notifications/removeAll", {}).then(d => { if (Array.isArray(d)) setNotifs(d) }).catch(() => setNotifs(prev => prev.filter(n => n.pinned)))
	}
	const removeNotif = (n) => {
		setNotifs(prev => prev.filter(x => x.id !== n.id))
		removeServerNotification(n.id)
	}

	async function goOnline() {
		await setOffline(false)
		navigate("/login")
	}

	return (
		<TooltipProvider delayDuration={400}>
			<ScrollToTop />
			<div className="min-h-dvh">
				<Header
					notifs={notifs}
					unreadCount={unreadCount}
					bellOpen={bellOpen}
					setBellOpen={setBellOpen}
					onClearNotifs={clearNotifs}
					onRemoveNotif={removeNotif}
					downloadCount={downloadCount}
				/>
				{offline && (
					<div className="app-no-drag flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-neon-amber/30 bg-neon-amber/10 px-[5%] py-2 text-sm text-text-secondary">
						<span>
							<i className="bi bi-wifi-off mr-1.5 text-neon-amber" aria-hidden="true" />
							Offlinemodus aktiv — nur installierte Spiele verfügbar.
						</span>
						<button className="cta cta-secondary !px-3 !py-1 text-xs" onClick={goOnline}>Anmelden</button>
					</div>
				)}
				{leakOpen && !offline && (
					<div className="app-no-drag flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-error/30 bg-error/10 px-[5%] py-2 text-sm text-text-secondary">
						<span>
							<i className="bi bi-shield-exclamation mr-1.5 text-error" aria-hidden="true" />
							Dein Passwort steht in einem bekannten Datenleck. Bitte ändere es.
						</span>
						<button className="cta cta-secondary !px-3 !py-1 text-xs" onClick={() => navigate("/settings?tab=sicherheit")}>Passwort ändern</button>
						<button
							className="cta cta-ghost !px-3 !py-1 text-xs"
							onClick={() => openExternal("https://sketch-company.de/docs/sicherheit/geleakte-zugangsdaten")}
						>
							Was bedeutet das?
						</button>
					</div>
				)}
				<PageContextMenu>
					<main>
						{/* Seitenübergang: kurzer Fade + y-Versatz, keyed auf den Pfad.
						    mode="wait" blendet die alte Seite aus, bevor die neue kommt. */}
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={location.pathname}
								variants={pageVariants}
								initial="initial"
								animate="animate"
								exit="exit"
							>
								{outlet}
							</motion.div>
						</AnimatePresence>
					</main>
				</PageContextMenu>
			</div>
		</TooltipProvider>
	)
}
