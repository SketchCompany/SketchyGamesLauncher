// Verhindert das Aufblitzen von Skeletons/Ladeanzeigen beim „Erneut versuchen": ist `active`
// true (= Retry), wird das Anwenden des Ergebnisses so verzögert, dass seit dem Aufruf mindestens
// `ms` vergangen sind — synchron zum 1s-Ladekreis des Buttons. Bei initialem Laden (active=false)
// ohne Verzögerung, damit schnelle lokale Daten sofort erscheinen.
//
// Nutzung:
//   const settle = minSettle(retry)
//   get(url).then(d => settle(() => setData(d))).catch(e => settle(() => setError(e)))
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export function minSettle(active, ms = 1000) {
	const start = Date.now()
	return async (apply) => {
		if (active) {
			const remaining = ms - (Date.now() - start)
			if (remaining > 0) await sleep(remaining)
		}
		apply()
	}
}
