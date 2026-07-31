/**
 * Cover-/Thumbnail-Bild mit Blur-up: solange das Bild lädt, liegt ein Shimmer-Skeleton
 * dahinter; ist es geladen, blendet es sanft ein (opacity, kurz). Bei Ladefehler
 * verschwinden Skeleton und Bild (wie der bisherige `hideBrokenImg`-Handler).
 *
 * Drop-in für rohe Cover-<img>: in einem bereits `relative` positionierten Container
 * platzieren und die bisherigen Bild-Klassen an `className` übergeben.
 */
import { useState } from "react"
import { motion } from "framer-motion"
import { T_BASE } from "../lib/motion.js"
import { cn } from "@/lib/utils"

export default function CoverImage({ src, alt, className, skeletonClassName, loading = "lazy", ...rest }) {
	const [loaded, setLoaded] = useState(false)
	const [failed, setFailed] = useState(false)

	return (
		<>
			{!loaded && !failed && (
				<span className={cn("skeleton absolute inset-0 z-0 rounded-none", skeletonClassName)} aria-hidden="true" />
			)}
			{!failed && (
				<motion.img
					src={src}
					alt={alt}
					loading={loading}
					onLoad={() => setLoaded(true)}
					onError={() => setFailed(true)}
					initial={{ opacity: 0 }}
					animate={{ opacity: loaded ? 1 : 0 }}
					transition={T_BASE}
					className={cn("relative z-[1]", className)}
					{...rest}
				/>
			)}
		</>
	)
}
