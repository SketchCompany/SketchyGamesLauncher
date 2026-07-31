// rangePlanner.js — bündelt die per Delta zu ladenden Manifest-Einträge zu möglichst wenigen
// HTTP-Range-Anfragen. Reine Rechnung, kein I/O — deshalb in einer eigenen Datei und als einziges
// Stück des Download-Pfads mit Unit-Tests (test/rangePlanner.test.js, `npm run test:unit`).
//
// WARUM: bis hierher holte der Launcher JEDE geänderte Datei mit einem eigenen Range-Request. Ein
// Update mit 800 geänderten Dateien waren 800 Anfragen pro Nutzer. Gegen Cloudflare R2 ist das
// zusätzlich eine bezahlte Class-B-Operation je Anfrage, während der EGRESS kostenlos ist.
//
// Daraus folgt die Optimierungsrichtung, und sie ist kontraintuitiv: ein paar UNVERÄNDERTE Bytes
// mitzuladen, um eine Anfrage zu sparen, ist fast immer der bessere Tausch. Die Einträge liegen im
// Zip nach Offset sortiert, und ein neu gebautes Spiel ändert meist zusammenhängende Blöcke —
// benachbarte Einträge lassen sich also zu EINEM Lauf verschmelzen und lokal wieder auftrennen.
//
// Drei Regeln:
//   1. Lücke ≤ Toleranz  ⇒ verschmelzen (Start: 1 MiB).
//   2. Immer noch mehr als TARGET_RUNS Läufe ⇒ Toleranz verdoppeln, solange die mitgeladenen
//      unveränderten Bytes unter WASTE_BUDGET bleiben.
//   3. Kämen dabei ≥ WHOLE_ZIP_FRACTION des Zips zusammen ⇒ gar nicht erst stückeln, sondern das
//      ganze Zip in EINER Anfrage holen. Das ist dann sowohl billiger als auch schneller.

/** Ab welcher Lücke zwei Einträge NICHT mehr verschmolzen werden (Startwert). */
const DEFAULT_GAP_BYTES = 1024 * 1024
/** Angestrebte Obergrenze an Anfragen je Update. Darüber wird die Toleranz erhöht. */
const TARGET_RUNS = 64
/** Wie viel unveränderte Nutzlast das Verschmelzen höchstens mitziehen darf (Anteil der Zip-Größe). */
const WASTE_BUDGET_FRACTION = 0.15
/** Ab diesem Anteil der Zip-Größe lohnt das Stückeln nicht mehr. */
const WHOLE_ZIP_FRACTION = 0.6
/** Sicherheitsnetz: Läufe werden nie größer als das, damit ein Abbruch nicht alles verwirft. */
const MAX_RUN_BYTES = 256 * 1024 * 1024

/**
 * Verschmilzt die (nach Offset sortierten) Einträge mit einer festen Lückentoleranz.
 * @returns {{runs: Array<{start:number,end:number,entries:Array}>, wasteBytes:number, payloadBytes:number}}
 */
function mergeWithGap(sorted, gapBytes) {
	const runs = []
	let wasteBytes = 0
	let payloadBytes = 0
	for (const entry of sorted) {
		const start = entry.offset
		const end = entry.offset + entry.compressedSize - 1 // inklusiv
		payloadBytes += entry.compressedSize
		const last = runs[runs.length - 1]
		const gap = last ? start - (last.end + 1) : Infinity
		// `gap < 0` kann bei überlappenden/doppelten Einträgen auftreten — dann ebenfalls anhängen,
		// die Aufteilung beim Laden arbeitet ohnehin über absolute Offsets.
		const wouldGrowTo = last ? end - last.start + 1 : 0
		if (last && gap <= gapBytes && wouldGrowTo <= MAX_RUN_BYTES) {
			if (gap > 0) wasteBytes += gap
			last.end = Math.max(last.end, end)
			last.entries.push(entry)
		} else {
			runs.push({ start, end, entries: [entry] })
		}
	}
	return { runs, wasteBytes, payloadBytes }
}

/**
 * Plant die Anfragen für eine Liste zu ladender Manifest-Einträge.
 *
 * @param {Array} entries  Einträge aus dem Manifest (offset, compressedSize, …) — die Liste wird
 *   NICHT verändert.
 * @param {number} zipSizeBytes  Gesamtgröße des Build-Zips. 0/unbekannt ⇒ die Ganz-Zip-Schwelle
 *   entfällt (ohne Bezugsgröße lässt sie sich nicht beurteilen).
 * @returns {{mode:"whole-zip", reason:string} | {mode:"runs", runs:Array, empty:Array, wasteBytes:number, payloadBytes:number, gapBytes:number}}
 *   `empty` sind Einträge ohne Inhalt (leere Dateien) — die brauchen GAR KEINE Anfrage und werden
 *   direkt angelegt. Ohne diese Sonderbehandlung entstünde `Range: bytes=100-99`, worauf jeder
 *   korrekte Server mit 416 antwortet; der Launcher hätte das als „Range nicht unterstützt"
 *   gedeutet und für ein einziges `.gitkeep` das komplette Zip geladen.
 */
function planRanges(entries, zipSizeBytes, opts = {}) {
	const targetRuns = opts.targetRuns || TARGET_RUNS
	const wasteBudgetFraction = opts.wasteBudgetFraction != null ? opts.wasteBudgetFraction : WASTE_BUDGET_FRACTION
	const wholeZipFraction = opts.wholeZipFraction != null ? opts.wholeZipFraction : WHOLE_ZIP_FRACTION
	const startGap = opts.gapBytes || DEFAULT_GAP_BYTES

	const empty = []
	const withBytes = []
	for (const e of entries) {
		if (!e.compressedSize) empty.push(e)
		else withBytes.push(e)
	}
	if (withBytes.length === 0) return { mode: "runs", runs: [], empty, wasteBytes: 0, payloadBytes: 0, gapBytes: startGap }

	const sorted = withBytes.slice().sort((a, b) => a.offset - b.offset)
	const wasteBudget = zipSizeBytes > 0 ? zipSizeBytes * wasteBudgetFraction : Infinity

	let best = mergeWithGap(sorted, startGap)
	let gapBytes = startGap
	// Solange zu viele Anfragen übrig sind, gröber zusammenfassen — aber nur, solange das
	// Verschwendungsbudget das hergibt. Der Deckel bei 2 GiB verhindert eine Endlosschleife bei
	// unbegrenztem Budget (zipSizeBytes unbekannt).
	while (best.runs.length > targetRuns && gapBytes < 2 * 1024 * 1024 * 1024) {
		const nextGap = gapBytes * 2
		const candidate = mergeWithGap(sorted, nextGap)
		if (candidate.wasteBytes > wasteBudget) break
		gapBytes = nextGap
		best = candidate
		if (best.runs.length === 1) break
	}

	if (zipSizeBytes > 0) {
		const fetchBytes = best.payloadBytes + best.wasteBytes
		if (fetchBytes >= zipSizeBytes * wholeZipFraction) {
			return { mode: "whole-zip", reason: `Delta deckt ${Math.round((fetchBytes / zipSizeBytes) * 100)} % des Zips ab` }
		}
	}

	return { mode: "runs", runs: best.runs, empty, wasteBytes: best.wasteBytes, payloadBytes: best.payloadBytes, gapBytes }
}

module.exports = { planRanges, mergeWithGap, DEFAULT_GAP_BYTES, TARGET_RUNS, WASTE_BUDGET_FRACTION, WHOLE_ZIP_FRACTION, MAX_RUN_BYTES }
