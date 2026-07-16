import "./pages.css"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Button } from "../components/ui/index.jsx"

export default function ErrorPage() {
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const message = params.get("m") || "Diese Seite konnte nicht gefunden werden."
    return (
        <div className="page">
            <div className="state-center" style={{ paddingTop: 120 }}>
                <i className="bi bi-exclamation-octagon" style={{ fontSize: 56, color: "var(--neon-magenta)" }} />
                <h1 style={{ margin: 0 }}>Ups!</h1>
                <p style={{ maxWidth: 420 }}>{message}</p>
                <Button variant="primary" onClick={() => navigate("/")}><i className="bi bi-house" /> Zur Startseite</Button>
            </div>
        </div>
    )
}
