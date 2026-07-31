// Zuordnung deklarativer Benachrichtigungs-Aktionen (kind) → Effekt im Renderer.
// Bewusst OHNE useGameActions/useDialog (die hängen an Providern, die den Toast-Stapel NICHT
// umschließen) — stattdessen direkt über send() + useNavigate. Nur useNavigate braucht Router-
// Kontext, und der NotificationsProvider liegt innerhalb des BrowserRouter.
import { useNavigate } from "react-router-dom"
import { send } from "./api.js"

export function useNotificationActions() {
	const navigate = useNavigate()

	return async function run(action) {
		if (!action || !action.kind) return
		switch (action.kind) {
			case "play":
				// Server re-resolved das Produkt aus der Registry; name (=Spiel-id) genügt, start wird geprüft.
				await send("/api/games/start", { filepath: action.start, name: action.gameId }, true).catch(() => {})
				break
			case "openFolder":
				await send("/api/games/open", { filepath: action.start, name: action.gameId }, true).catch(() => {})
				break
			case "navigate":
			case "updateGame":
			case "retryDownload":
				if (action.to) navigate(action.to)
				else if (action.gameId) navigate("/store/" + encodeURIComponent(action.gameId))
				break
			default:
				break
		}
	}
}
