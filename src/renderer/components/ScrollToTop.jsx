import { useEffect } from "react"
import { useLocation, useNavigationType } from "react-router-dom"

/**
 * Setzt den Fenster-Scroll bei Navigation zurück. Die Seite scrollt am `window`/`body`
 * (kein innerer Scroll-Container), und React Router hält den Offset sonst über Routenwechsel
 * hinweg — deshalb öffnete z. B. eine Spielseite „mittendrin“ statt oben.
 *
 * Nur bei PUSH/REPLACE nach oben springen; bei POP (Zurück/Vor) bleibt die vorherige
 * Scroll-Position erhalten. `behavior: "auto"` umgeht das globale `scroll-behavior: smooth`.
 */
export default function ScrollToTop() {
	const { pathname } = useLocation()
	const navType = useNavigationType()

	useEffect(() => {
		if (navType === "POP") return
		window.scrollTo({ top: 0, left: 0, behavior: "auto" })
	}, [pathname, navType])

	return null
}
