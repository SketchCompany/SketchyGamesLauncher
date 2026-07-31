import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import StorePreviewBody from "./StorePreviewBody.jsx"

const MAX_WIDTH = 320
const GAP = 8
const MARGIN = 12

/**
 * Steam-artiges Detail-Fenster neben der gehoverten Store-Karte (Port aus der Web-App).
 * Portal in den <body>, `position: fixed` anhand der Karten-Bounding-Box.
 */
export default function StoreCardPreview({ game, anchor, open, onMouseEnter, onMouseLeave }) {
	const ref = useRef(null)
	const [pos, setPos] = useState(null)
	const [entered, setEntered] = useState(false)

	useLayoutEffect(() => {
		const node = ref.current
		if (!node) return
		const vw = window.innerWidth
		const vh = window.innerHeight
		const width = Math.min(MAX_WIDTH, vw - 2 * MARGIN)
		const rightSpace = vw - anchor.right - GAP - MARGIN
		const leftSpace = anchor.left - GAP - MARGIN

		let left
		if (rightSpace >= width) left = anchor.right + GAP
		else if (leftSpace >= width) left = anchor.left - GAP - width
		else if (rightSpace >= leftSpace) left = vw - MARGIN - width
		else left = MARGIN
		left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN))

		const h = node.offsetHeight
		const top = Math.max(MARGIN, Math.min(anchor.top, vh - h - MARGIN))
		setPos({ left, top, width })
	}, [anchor])

	useEffect(() => {
		if (pos) {
			const id = requestAnimationFrame(() => setEntered(true))
			return () => cancelAnimationFrame(id)
		}
	}, [pos])

	return createPortal(
		<div
			ref={ref}
			className={`store-preview store-preview-panel${entered && open ? " store-preview--visible" : ""}`}
			style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, width: pos?.width ?? MAX_WIDTH }}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			role="dialog"
			aria-label={`${game.title} – Vorschau`}
		>
			<StorePreviewBody game={game} />
		</div>,
		document.body,
	)
}
