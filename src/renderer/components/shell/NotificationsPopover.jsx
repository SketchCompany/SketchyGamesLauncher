import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import NotificationItem from "../NotificationItem.jsx"

/**
 * Benachrichtigungs-Popover am Glocken-Icon. Einträge werden über das gemeinsame NotificationItem
 * gerendert (gleiche Optik wie die Toasts) inkl. Aktions-Buttons und pro Eintrag einem ✕
 * (außer bei angepinnten). „Alle löschen" entfernt alles bis auf angepinnte.
 */
export default function NotificationsPopover({ open, onOpenChange, items, onClear, onRemove, children }) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>{children}</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">Benachrichtigungen</TooltipContent>
			</Tooltip>
			<PopoverContent
				align="end"
				sideOffset={10}
				className="app-no-drag w-80 p-0 border-border-strong bg-bg-2/95 backdrop-blur-xl shadow-[var(--elevation)] rounded-lg"
			>
				<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
					<h4 className="m-0 font-display text-sm font-bold text-text-primary">Benachrichtigungen</h4>
					<div className="flex items-center gap-1">
						{items.some(n => !n.pinned) && (
							<button
								onClick={onClear}
								aria-label="Alle Benachrichtigungen löschen"
								title="Alle löschen"
								className="grid size-8 cursor-pointer place-items-center rounded text-text-secondary transition-colors duration-200 hover:bg-accent hover:text-neon-green"
							>
								<i className="bi bi-trash" aria-hidden="true" />
							</button>
						)}
						<button
							onClick={() => onOpenChange(false)}
							aria-label="Benachrichtigungen schließen"
							className="grid size-8 cursor-pointer place-items-center rounded text-text-secondary transition-colors duration-200 hover:bg-accent hover:text-text-primary"
						>
							<i className="bi bi-x-lg" aria-hidden="true" />
						</button>
					</div>
				</div>
				{items.length === 0 ? (
					<div className="px-4 py-8 text-center text-sm text-text-muted">
						<i className="bi bi-bell-slash mb-2 block text-xl" aria-hidden="true" />
						Gerade keine Benachrichtigungen.
					</div>
				) : (
					<div className="flex max-h-96 flex-col gap-2 overflow-y-auto p-2">
						{items.map(n => (
							<NotificationItem
								key={n.id}
								notification={n}
								showClose
								onClose={() => onRemove?.(n)}
								onAfterAction={() => onRemove?.(n)}
							/>
						))}
					</div>
				)}
			</PopoverContent>
		</Popover>
	)
}
