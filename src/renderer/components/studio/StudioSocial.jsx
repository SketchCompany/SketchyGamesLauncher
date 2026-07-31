import { openExternal } from "../../lib/api.js"

/** Icon + Standard-Label je Plattform (bootstrap-icons). Port aus der Web-App. */
const PLATFORM = {
	website: { icon: "bi-globe2", label: "Website" },
	discord: { icon: "bi-discord", label: "Discord" },
	twitter: { icon: "bi-twitter-x", label: "Twitter / X" },
	youtube: { icon: "bi-youtube", label: "YouTube" },
	twitch: { icon: "bi-twitch", label: "Twitch" },
	instagram: { icon: "bi-instagram", label: "Instagram" },
	github: { icon: "bi-github", label: "GitHub" },
	steam: { icon: "bi-steam", label: "Steam" },
	itch: { icon: "bi-controller", label: "itch.io" },
	bluesky: { icon: "bi-cloud", label: "Bluesky" },
	mastodon: { icon: "bi-mastodon", label: "Mastodon" },
	other: { icon: "bi-link-45deg", label: "Link" },
}

export default function StudioSocial({ website, links }) {
	const items = []
	if (website) items.push({ platform: "website", url: website })
	if (links) items.push(...links)
	if (items.length === 0) return null

	// Externe Links über den Launcher öffnen (nie window.open auf beliebige URLs).
	const open = (e, url) => { e.preventDefault(); openExternal(url) }

	return (
		<aside className="studio-sidebar" aria-label="Links des Studios">
			<div className="studio-sidebar__sticky hud-frame">
				<p className="studio-sidebar__title">
					<span className="bi bi-link-45deg" aria-hidden="true" /> Links
				</p>
				<ul className="studio-sidebar__list">
					{items.map((link, i) => {
						const meta = PLATFORM[link.platform] ?? PLATFORM.other
						return (
							<li key={`${link.platform}-${i}`}>
								<a href={link.url} onClick={e => open(e, link.url)} className="studio-sidebar__link">
									<span className={`bi ${meta.icon}`} aria-hidden="true" />
									<span className="studio-sidebar__link-label">{link.label?.trim() || meta.label}</span>
									<span className="bi bi-box-arrow-up-right studio-sidebar__ext" aria-hidden="true" />
								</a>
							</li>
						)
					})}
				</ul>
			</div>
		</aside>
	)
}
