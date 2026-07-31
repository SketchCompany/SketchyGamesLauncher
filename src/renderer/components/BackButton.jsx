import { useNavigate } from "react-router-dom"

/** Kleiner Zurück-Button für Unterseiten (ersetzt die frühere Breadcrumb-Leiste). */
export default function BackButton({ label = "Zurück" }) {
	const navigate = useNavigate()
	return (
		<button
			onClick={() => navigate(-1)}
			className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm font-bold text-text-secondary transition-colors duration-200 hover:bg-accent hover:text-neon-green focus-visible:outline-2 focus-visible:outline-neon-green"
		>
			<i className="bi bi-arrow-left" aria-hidden="true" />
			{label}
		</button>
	)
}
