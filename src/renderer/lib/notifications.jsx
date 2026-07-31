import { createContext, useContext, useCallback, useState, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toastVariants } from "./motion.js"
import { removeServerNotification } from "./notificationsClient.js"
import NotificationItem from "../components/NotificationItem.jsx"

const NotifyCtx = createContext(null)

// Toast-Stapel unten rechts. API: useNotify()(title, message, type, duration, opts).
// opts = { actions, serverId } — actions rendert kleine Buttons (via NotificationItem);
// serverId verknüpft den Toast mit einem persistenten Glocken-Eintrag (für „nach Aktion entfernen").
export function NotificationsProvider({ children }) {
	const [toasts, setToasts] = useState([])
	const idRef = useRef(0)

	const remove = useCallback((id) => {
		setToasts(t => t.filter(x => x.id !== id))
	}, [])

	const notify = useCallback((title, message, type = "note", duration = 8000, opts = {}) => {
		const id = ++idRef.current
		const { actions, serverId } = opts || {}
		setToasts(t => [...t, { id, title, message, type, actions, serverId }])
		if (duration > 0) setTimeout(() => remove(id), duration)
		return id
	}, [remove])

	// X: nur den (flüchtigen) Toast schließen — der Glocken-Eintrag bleibt.
	const close = useCallback((toast) => remove(toast.id), [remove])
	// Aktion ausgeführt: Toast schließen UND den persistenten Eintrag entfernen (falls vorhanden).
	const afterAction = useCallback((toast) => {
		remove(toast.id)
		if (toast.serverId != null) removeServerNotification(toast.serverId)
	}, [remove])

	return (
		<NotifyCtx.Provider value={notify}>
			{children}
			<div className="fixed bottom-4 right-4 z-[1100] flex w-80 flex-col gap-2" aria-live="polite">
				<AnimatePresence initial={false}>
					{toasts.map(t => (
						<motion.div key={t.id} layout variants={toastVariants} initial="initial" animate="animate" exit="exit">
							<NotificationItem
								notification={t}
								showClose
								hoverClose
								onClose={close}
								onAfterAction={afterAction}
								className="w-full shadow-[var(--elevation)]"
							/>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</NotifyCtx.Provider>
	)
}

export function useNotify() {
	const ctx = useContext(NotifyCtx)
	if (!ctx) throw new Error("useNotify must be used within NotificationsProvider")
	return ctx
}
