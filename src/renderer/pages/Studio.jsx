import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { get } from "../lib/api.js"
import StudioProfile from "../components/studio/StudioProfile.jsx"
import { GameDetailSkeleton } from "../components/Skeletons.jsx"

/**
 * Entwicklerseite /studio/:slug — lädt Profil + veröffentlichte Spiele über /api/studio/:slug
 * (Proxy zur v1-API) und rendert die aus der Web-App portierte StudioProfile-Ansicht.
 */
export default function Studio() {
	const { slug } = useParams()
	const navigate = useNavigate()
	const [data, setData] = useState(undefined) // undefined = lädt, null = nicht gefunden/Fehler
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		let alive = true
		setData(undefined)
		setFailed(false)
		get(`/api/studio/${encodeURIComponent(slug)}`)
			.then(d => { if (alive) setData(d && d.studio ? d : null) })
			.catch(() => { if (alive) { setData(null); setFailed(true) } })
		return () => { alive = false }
	}, [slug])

	return (
		<div className="studio-route">
			<button type="button" className="studio-back" onClick={() => navigate(-1)}>
				<span className="bi bi-arrow-left" aria-hidden="true" /> Zurück
			</button>

			{data === undefined ? (
				<GameDetailSkeleton />
			) : data === null ? (
				<div className="store-unavailable hud-frame" role="status">
					<span className="bi bi-person-x" aria-hidden="true" />
					<h2>Entwickler nicht gefunden</h2>
					<p>{failed ? "Das Studio ist gerade nicht erreichbar. Versuch es gleich nochmal." : "Zu diesem Entwickler gibt es keine Seite."}</p>
				</div>
			) : (
				<StudioProfile studio={data.studio} games={data.games || []} />
			)}
		</div>
	)
}
