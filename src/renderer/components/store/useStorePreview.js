import { useCallback, useEffect, useRef, useState } from "react"

// Hover-Zustand für das Steam-artige Detail-Fenster (Port aus der Web-App, unverändert).
const SHOW_DELAY = 160
const HIDE_DELAY = 70
const EXIT_MS = 160
const MIN_PREVIEW_WIDTH = 480

function canShowPreview() {
	if (typeof window === "undefined") return false
	if (!window.matchMedia("(hover: hover)").matches) return false
	return window.innerWidth >= MIN_PREVIEW_WIDTH
}

export function useStorePreview() {
	const ref = useRef(null)
	const [anchor, setAnchor] = useState(null)
	const [open, setOpen] = useState(false)
	const showTimer = useRef(0)
	const hideTimer = useRef(0)
	const unmountTimer = useRef(0)

	const clearTimers = useCallback(() => {
		window.clearTimeout(showTimer.current)
		window.clearTimeout(hideTimer.current)
		window.clearTimeout(unmountTimer.current)
	}, [])

	const handleEnter = useCallback(() => {
		window.clearTimeout(hideTimer.current)
		window.clearTimeout(unmountTimer.current)
		if (!canShowPreview()) return
		showTimer.current = window.setTimeout(() => {
			if (ref.current) {
				setAnchor(ref.current.getBoundingClientRect())
				setOpen(true)
			}
		}, SHOW_DELAY)
	}, [])

	const scheduleHide = useCallback(() => {
		window.clearTimeout(showTimer.current)
		hideTimer.current = window.setTimeout(() => {
			setOpen(false)
			unmountTimer.current = window.setTimeout(() => setAnchor(null), EXIT_MS)
		}, HIDE_DELAY)
	}, [])

	const keepOpen = useCallback(() => {
		window.clearTimeout(hideTimer.current)
		window.clearTimeout(unmountTimer.current)
		setOpen(true)
	}, [])

	useEffect(() => clearTimers, [clearTimers])

	return {
		ref,
		anchor,
		open,
		triggerProps: { onMouseEnter: handleEnter, onMouseLeave: scheduleHide },
		previewProps: { onMouseEnter: keepOpen, onMouseLeave: scheduleHide },
	}
}
