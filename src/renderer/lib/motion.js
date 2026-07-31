/**
 * Zentrale Motion-Presets für framer-motion — bewusst kurz (≤~0.22 s) und konsistent,
 * damit Bewegung elegant wirkt, ohne die UX auszubremsen. Es wird ausschließlich
 * `transform`/`opacity` animiert (compositor-freundlich, kein Layout-Thrash).
 *
 * `prefers-reduced-motion` wird global über <MotionConfig reducedMotion="user"> in
 * main.jsx geehrt (ergänzt die CSS-Regel in styles/app.css) — einzelne Komponenten
 * müssen das nicht mehr abfragen.
 */

// Sanftes ease-out (kein „all“, keine Overshoots die stören).
export const EASE = [0.16, 1, 0.3, 1]
export const T_FAST = { duration: 0.18, ease: EASE }
export const T_BASE = { duration: 0.2, ease: EASE }
// Feder für Hover-Interaktionen — schnell und gedämpft, nicht wabbelig.
export const SPRING = { type: "spring", stiffness: 420, damping: 32, mass: 0.6 }

/** Seitenübergang am <Outlet/> (fade + kleiner y-Versatz). */
export const pageVariants = {
	initial: { opacity: 0, y: 8 },
	animate: { opacity: 1, y: 0, transition: T_BASE },
	exit: { opacity: 0, y: -6, transition: T_FAST },
}

/** Inhalt sanft einblenden (Skeleton→Inhalt-Crossfade, Entrance einzelner Karten). */
export const fadeUp = {
	initial: { opacity: 0, y: 8 },
	animate: { opacity: 1, y: 0, transition: T_BASE },
}

/** Container für gestaffelte Grid-/Row-Reveals. */
export const staggerContainer = {
	initial: {},
	animate: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
}
export const staggerItem = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0, transition: T_FAST },
}

/** Modal/Dialog: Backdrop nur opacity, Panel opacity+scale. */
export const backdropVariants = {
	initial: { opacity: 0 },
	animate: { opacity: 1, transition: T_FAST },
	exit: { opacity: 0, transition: T_FAST },
}
export const dialogPanelVariants = {
	initial: { opacity: 0, scale: 0.96, y: 8 },
	animate: { opacity: 1, scale: 1, y: 0, transition: T_BASE },
	exit: { opacity: 0, scale: 0.97, y: 4, transition: T_FAST },
}

/** Toast: schnell & smooth von rechts einschieben (Feder), zügig nach rechts wegschieben. */
export const toastVariants = {
	initial: { opacity: 0, x: 48, scale: 0.96 },
	animate: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } },
	exit: { opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } },
}

/**
 * Spielstart-Overlay: der Glas-Filter wächst als Kreis aus dem geklickten Button über das ganze
 * Fenster. `custom` = { x, y, r } (Buttonmitte in Fensterkoordinaten + Radius bis zur entferntesten
 * Ecke). Ausgeblendet wird flächig — ein zurückschrumpfender Kreis wirkt wie ein Rückschritt.
 */
export const REVEAL_MS = 450
export const launchOverlayVariants = {
	initial: ({ x, y }) => ({ opacity: 1, clipPath: `circle(0px at ${x}px ${y}px)` }),
	animate: ({ x, y, r }) => ({
		opacity: 1,
		clipPath: `circle(${r}px at ${x}px ${y}px)`,
		transition: { duration: REVEAL_MS / 1000, ease: EASE },
	}),
	exit: { opacity: 0, transition: { duration: 0.3, ease: EASE } },
}
/**
 * Rückfall bei `prefers-reduced-motion`: kein Kreis, nur Aufblenden. (framer-motions
 * `reducedMotion="user"` greift nur bei Transforms — `clip-path` müsste sonst selbst animieren.)
 */
export const launchOverlayFadeVariants = {
	initial: { opacity: 0 },
	animate: { opacity: 1, transition: { duration: 0.25, ease: EASE } },
	exit: { opacity: 0, transition: { duration: 0.3, ease: EASE } },
}
/**
 * Orbit-Spinner: drei Ringe mit unterschiedlicher Umlaufzeit, abwechselnd im und gegen den
 * Uhrzeigersinn. `rotate` ist ein Transform — bei `prefers-reduced-motion` stellt framer-motion die
 * Ringe daher von selbst still, der Opacity-Puls des Kerns läuft weiter.
 */
export const orbitRing = (seconds, reverse = false) => ({
	animate: { rotate: reverse ? -360 : 360 },
	transition: { duration: seconds, repeat: Infinity, ease: "linear" },
})
export const orbitCorePulse = {
	animate: { opacity: [0.55, 1, 0.55], scale: [0.9, 1.08, 0.9] },
	transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
}

/** Mikro-Interaktionen. */
export const hoverLift = { y: -4, transition: SPRING }
export const tapPress = { scale: 0.97 }

/**
 * Ab dieser Listenlänge wird NICHT mehr gestaffelt (Web-Interface-Guideline: große
 * Listen nicht unnötig animieren — sonst verzögert der Reveal die wahrgenommene Ladezeit).
 */
export const STAGGER_CAP = 50
