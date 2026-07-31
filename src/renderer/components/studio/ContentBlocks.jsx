import { Fragment } from "react"

/** Inline-Marker: `**fett**` und `*kursiv*` (bewusst simpel). Port aus der Web-App. */
export function renderInline(text, keyPrefix) {
	return String(text ?? "").split(/\*\*(.+?)\*\*/g).map((chunk, i) => {
		if (i % 2 === 1) return <strong key={`${keyPrefix}b${i}`}>{chunk}</strong>
		return (
			<Fragment key={`${keyPrefix}f${i}`}>
				{chunk.split(/\*(.+?)\*/g).map((part, j) => (j % 2 === 1 ? <em key={`${keyPrefix}i${i}-${j}`}>{part}</em> : part))}
			</Fragment>
		)
	})
}

export default function ContentBlocks({ blocks, className = "" }) {
	return (
		<div className={`content-blocks ${className}`.trim()}>
			{(blocks ?? []).map((block, i) => {
				if (block.type === "heading") return <h3 key={i} className="content-blocks__heading">{renderInline(block.text, `h${i}`)}</h3>
				if (block.type === "paragraph") return <p key={i} className="content-blocks__paragraph">{renderInline(block.text, `p${i}`)}</p>
				if (block.type === "list") {
					const ListTag = block.ordered ? "ol" : "ul"
					return (
						<ListTag key={i} className="content-blocks__list">
							{(block.items ?? []).map((item, j) => <li key={j}>{renderInline(item, `l${i}-${j}`)}</li>)}
						</ListTag>
					)
				}
				return (
					<figure key={i} className="content-blocks__figure">
						<div className="content-blocks__image">
							<img src={block.src} alt={block.caption ?? ""} loading="lazy" />
						</div>
						{block.caption && <figcaption className="content-blocks__caption">{block.caption}</figcaption>}
					</figure>
				)
			})}
		</div>
	)
}
