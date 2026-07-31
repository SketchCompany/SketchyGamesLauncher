export default function Loading() {
	return (
		<div className="grid min-h-dvh place-items-center">
			<div className="flex flex-col items-center gap-4">
				<img src="/img/app.png" width={56} height={56} alt="" className="animate-pulse rounded-xl" />
				<p className="font-pixel text-[10px] tracking-widest text-neon-green">LÄDT…</p>
			</div>
		</div>
	)
}
