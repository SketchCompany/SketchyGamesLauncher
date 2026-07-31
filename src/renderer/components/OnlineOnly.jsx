import { useNavigate } from "react-router-dom"
import { useOffline } from "../lib/offline.jsx"
import ErrorState from "./ErrorState.jsx"

/**
 * Wrapper für Online-Routen (Store, Suche, Konto, Produkt …). Im Offlinemodus wird die Seite NICHT
 * gerendert, sondern ein Hinweis „Nur online verfügbar" mit „Anmelden"-Aktion (schaltet den
 * Offlinemodus ab und geht zum Login). Sonst normal die Kind-Seite.
 */
export default function OnlineOnly({ children }) {
	const { offline, setOffline } = useOffline()
	const navigate = useNavigate()

	if (!offline) return children

	async function goOnline() {
		await setOffline(false)
		navigate("/login")
	}

	return (
		<div className="page">
			<ErrorState
				variant="empty"
				icon="bi-wifi-off"
				title="Nur online verfügbar"
				message="Dieser Bereich ist im Offlinemodus deaktiviert. Melde dich an, um ihn zu nutzen."
				action={{ label: "Anmelden", onClick: goOnline }}
			/>
		</div>
	)
}
