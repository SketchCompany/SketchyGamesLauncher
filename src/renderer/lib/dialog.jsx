import { createContext, useContext, useCallback, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { backdropVariants, dialogPanelVariants } from "./motion.js"

const DialogCtx = createContext(null)

// Promise-basierter Modal-Dialog. API unverändert: useDialog().confirm(title, message) etc.
export function DialogProvider({ children }) {
	const [dialog, setDialog] = useState(null)

	const close = useCallback((result) => {
		setDialog(d => {
			if (d) d._resolve(result)
			return null
		})
	}, [])

	const showDialog = useCallback(({ title, message, actions = [{ label: "OK" }], body }) => {
		return new Promise(resolve => {
			setDialog({ title, message, actions, body, _resolve: resolve })
		})
	}, [])

	const confirm = useCallback((title, message) => {
		return showDialog({
			title, message,
			actions: [
				{ label: "Abbrechen", variant: "ghost" },
				{ label: "Bestätigen", variant: "primary" },
			],
		}).then(i => i === 1)
	}, [showDialog])

	return (
		<DialogCtx.Provider value={{ showDialog, confirm, close }}>
			{children}
			<AnimatePresence>
				{dialog && (
					<motion.div
						className="fixed inset-0 z-[1200] grid place-items-center bg-black/60 backdrop-blur-sm"
						onClick={() => close(-1)}
						variants={backdropVariants}
						initial="initial"
						animate="animate"
						exit="exit"
					>
						<motion.div
							role="dialog"
							aria-modal="true"
							aria-label={dialog.title || "Dialog"}
							className="hud-frame w-full max-w-sm bg-bg-2 p-6"
							onClick={e => e.stopPropagation()}
							variants={dialogPanelVariants}
						>
							{dialog.title && <h3 className="m-0 font-display text-lg font-bold text-text-primary">{dialog.title}</h3>}
							{dialog.message && <p className="mb-0 mt-2 text-sm text-text-secondary">{dialog.message}</p>}
							{dialog.body}
							<div className="mt-5 flex justify-end gap-2.5">
								{dialog.actions.map((a, i) => (
									<button
										key={i}
										className={`cta ${a.variant === "primary" ? "cta-primary" : "cta-secondary"} !px-4 !py-2 text-sm`}
										onClick={() => close(i)}
									>
										{a.label}
									</button>
								))}
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</DialogCtx.Provider>
	)
}

export function useDialog() {
	const ctx = useContext(DialogCtx)
	if (!ctx) throw new Error("useDialog must be used within DialogProvider")
	return ctx
}
