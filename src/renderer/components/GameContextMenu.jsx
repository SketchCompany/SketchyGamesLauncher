import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/shadcn/context-menu"
import { useGameActions } from "../lib/gameActions.jsx"

/**
 * Rechtsklick-Menü für ein installiertes Spiel (Bibliothek/Produktseite). `item` = Install-Datensatz
 * ({ name, start, title }). `onChanged` wird nach dem Deinstallieren aufgerufen (z. B. zum Neuladen).
 */
export default function GameContextMenu({ item, onChanged, children }) {
	const { play, openFolder, remove } = useGameActions()
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				{/* Das Event liefert die Menüzeile als Ursprung des Kreis-Reveals. */}
				<ContextMenuItem onSelect={(e) => play(item, e)}>
					<i className="bi bi-play-fill" aria-hidden="true" /> Spiel starten
				</ContextMenuItem>
				<ContextMenuItem onSelect={() => openFolder(item)}>
					<i className="bi bi-folder2-open" aria-hidden="true" /> Ordner öffnen
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem variant="destructive" onSelect={() => remove(item, onChanged)}>
					<i className="bi bi-trash" aria-hidden="true" /> Deinstallieren
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}
