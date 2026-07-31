import { useSearchParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { fadeUp } from "../lib/motion.js"

export default function ErrorPage() {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const message = params.get("m") || "Diese Seite konnte nicht gefunden werden."
	return (
		<div className="page grid place-items-center pt-24">
			<motion.div variants={fadeUp} initial="initial" animate="animate" className="hud-frame flex max-w-md flex-col items-center gap-4 p-10 text-center">
				<i className="bi bi-exclamation-octagon text-5xl text-neon-magenta" aria-hidden="true" />
				<h1 className="m-0 font-display text-3xl font-bold">Ups!</h1>
				<p className="m-0 text-text-secondary">{message}</p>
				<button className="cta cta-primary" onClick={() => navigate("/")}>
					<i className="bi bi-house" aria-hidden="true" /> Zur Startseite
				</button>
			</motion.div>
		</div>
	)
}
