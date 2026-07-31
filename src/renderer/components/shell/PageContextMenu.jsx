import { useNavigate } from "react-router-dom"
import { send } from "../../lib/api.js"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/shadcn/context-menu"

/**
 * Globales Rechtsklick-Menü auf der Seitenfläche (<main>): Browser-artige Aktionen (Zurück/Vorwärts/
 * Neu laden), Navigationsziele und „Schließen" (Launcher in den Hintergrund). Karten mit eigenem
 * Kontextmenü haben Vorrang (Radix stoppt die Weitergabe an dieses äußere Menü).
 */
export default function PageContextMenu({ children }) {
	const navigate = useNavigate()
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem onSelect={() => navigate(-1)}>
					<i className="bi bi-arrow-left" aria-hidden="true" /> Zurück
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => navigate(1)}>
					<i className="bi bi-arrow-right" aria-hidden="true" /> Vorwärts
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => window.location.reload()}>
					<i className="bi bi-arrow-clockwise" aria-hidden="true" /> Neu laden
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => navigate("/")}>
					<i className="bi bi-house" aria-hidden="true" /> Startseite
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => navigate("/store")}>
					<i className="bi bi-bag" aria-hidden="true" /> Store
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => navigate("/library")}>
					<i className="bi bi-controller" aria-hidden="true" /> Bibliothek
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => navigate("/downloads")}>
					<i className="bi bi-download" aria-hidden="true" /> Downloads
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => send("/api/window/hide").catch(() => {})}>
					<i className="bi bi-x-lg" aria-hidden="true" /> Schließen (Hintergrund)
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}
