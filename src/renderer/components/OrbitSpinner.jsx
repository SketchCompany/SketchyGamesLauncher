import { motion } from "framer-motion"
import { orbitRing, orbitCorePulse } from "../lib/motion.js"

// Drei konzentrische Bögen, die unterschiedlich schnell und abwechselnd gegenläufig kreisen, dazu
// ein pulsierender Kern. Bewusst ohne Bezug zum gestarteten Spiel — der Spinner funktioniert auch,
// wenn kein Cover geladen ist. Die Bögen entstehen über `strokeDasharray` (Strich + Lücke ergeben
// den Kreisumfang 2πr), gedreht wird jeder Kreis für sich um die Mitte der viewBox.
const RINGS = [
	{ r: 44, seconds: 1.4, reverse: false, color: "var(--color-neon-green)", width: 3, gapFactor: 0.72, opacity: 1 },
	{ r: 33, seconds: 2.1, reverse: true, color: "var(--color-neon-cyan)", width: 2.5, gapFactor: 0.78, opacity: 0.9 },
	{ r: 22, seconds: 3.2, reverse: false, color: "var(--color-neon-green)", width: 2, gapFactor: 0.82, opacity: 0.6 },
]

export default function OrbitSpinner({ size = 112, className }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			className={className}
			role="presentation"
			aria-hidden="true"
		>
			{RINGS.map(ring => {
				const circumference = 2 * Math.PI * ring.r
				const gap = circumference * ring.gapFactor
				return (
					<motion.circle
						key={ring.r}
						cx="50"
						cy="50"
						r={ring.r}
						fill="none"
						stroke={ring.color}
						strokeWidth={ring.width}
						strokeLinecap="round"
						strokeDasharray={`${circumference - gap} ${gap}`}
						opacity={ring.opacity}
						style={{
							transformOrigin: "50px 50px",
							transformBox: "view-box",
							filter: `drop-shadow(0 0 6px ${ring.color})`,
						}}
						{...orbitRing(ring.seconds, ring.reverse)}
					/>
				)
			})}
			<motion.circle
				cx="50"
				cy="50"
				r="6"
				fill="var(--color-neon-green)"
				style={{
					transformOrigin: "50px 50px",
					transformBox: "view-box",
					filter: "drop-shadow(0 0 10px var(--color-neon-green))",
				}}
				{...orbitCorePulse}
			/>
		</svg>
	)
}
