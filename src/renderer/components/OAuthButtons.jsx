import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { send } from "../lib/api.js"
import { useNotify } from "../lib/notifications.jsx"
import { useOffline } from "../lib/offline.jsx"
import { whenFocused } from "../lib/whenFocused.js"
import { notifySessionChanged } from "../lib/sessionEvents.js"
import { cn } from "@/lib/utils"

// Social-Login: öffnet den Systembrowser (Server-Endpoint /api/account/oauth → Loopback-Flow) und
// meldet bei Erfolg genauso an wie der Passwort-Login (Offlinemodus aus, zur Startseite).
// `brand` = Markenfarben wie auf der API-Login-Seite (nur .cta-Basis + Utilities, kein cta-secondary).
const PROVIDERS = [
	{ id: "github", label: "GitHub", icon: "bi-github", brand: "bg-[#19191e] text-white border-[#46464b] hover:bg-[#28282d]" },
	{ id: "google", label: "Google", icon: "bi-google", brand: "bg-[linear-gradient(45deg,rgba(235,68,52,.6)_0%,rgba(235,68,52,.6)_25%,rgba(251,186,20,.6)_25%,rgba(251,186,20,.6)_50%,rgba(47,168,84,.6)_50%,rgba(47,168,84,.6)_75%,rgba(84,123,192,.6)_75%,rgba(84,123,192,.6)_100%)] text-white font-semibold border-0 hover:brightness-110" },
	{ id: "discord", label: "Discord", icon: "bi-discord", brand: "bg-[#5865f2] text-white border-transparent hover:bg-[#6a76f5]" },
]

export default function OAuthButtons({ className }) {
	const navigate = useNavigate()
	const { setOffline } = useOffline()
	const notify = useNotify()
	const [pending, setPending] = useState(null) // provider-id während des Browser-Flows
	const cancelledRef = useRef(false) // vom Nutzer abgebrochen → keine Fehlermeldung zeigen

	// Der Nutzer steht beim Fehlschlag noch im Systembrowser — ein Toast, der dort abläuft, wird nie
	// gesehen. Also erst melden, wenn das Launcher-Fenster wieder vorne ist (sofort, wenn es das
	// schon ist). Bewusst nicht awaited: die Buttons sollen sofort wieder bedienbar sein.
	function toastOnReturn(title, message, type, duration) {
		whenFocused().then(() => notify(title, message, type, duration))
	}

	async function login(provider) {
		if (pending) return
		cancelledRef.current = false
		setPending(provider)
		try {
			// Lange offene Anfrage: der Server wartet auf den Browser-Rückruf (Timeout ~4 min);
			// bei Fehlschlag/Abbruch antwortet er sofort. raw=true, weil neben der fertigen
			// deutschen Meldung (`data`) auch der Ursachen-Code gebraucht wird.
			const res = await send("/api/account/oauth", { provider }, true)
			if (res && res.status === 1 && res.data && res.data.correct) {
				await setOffline(false)
				notifySessionChanged() // Store/Wunschliste des Vorgängers verwerfen (owned-Flags!).
				navigate("/", { replace: true })
				return
			}
			// „Abbrechen" im Launcher wie auf der Zustimmungsseite des Anbieters: der Nutzer weiß,
			// was er getan hat — ein Fehler-Toast wäre hier nur Lärm.
			if (cancelledRef.current || res?.code === "cancelled") return
			const message = typeof res?.data === "string" ? res.data : "Die Anmeldung ist fehlgeschlagen. Bitte versuch es erneut."
			if (res?.code === "access_denied") toastOnReturn("Anmeldung abgebrochen", message, "warning", 8000)
			else toastOnReturn("Anmeldung fehlgeschlagen", message, "error", 12000)
		} catch {
			// Wirft nur, wenn der lokale Express-Dienst nicht antwortet.
			if (!cancelledRef.current) toastOnReturn("Anmeldung fehlgeschlagen", "Der Launcher-Dienst hat nicht geantwortet. Starte den Launcher neu und versuch es erneut.", "error", 12000)
		} finally {
			setPending(null)
		}
	}

	// Bricht den laufenden Browser-Flow ab; der offene Login-Request kehrt dann sofort zurück.
	async function cancel() {
		cancelledRef.current = true
		try { await send("/api/account/oauth/cancel") } catch { /* egal */ }
	}

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{PROVIDERS.map(p => (
				<button key={p.id} type="button" className={cn("cta w-full", p.brand, pending && "opacity-60")} onClick={() => login(p.id)} disabled={!!pending}>
					<i className={`bi ${p.icon}`} aria-hidden="true" />
					{pending === p.id ? " Warte auf Anmeldung im Browser…" : ` Mit ${p.label} fortfahren`}
				</button>
			))}
			{pending && (
				<button type="button" onClick={cancel} className="mt-1 cursor-pointer self-center text-sm text-text-muted underline underline-offset-2 hover:text-text-primary">
					Abbrechen
				</button>
			)}
		</div>
	)
}
