// Tests der Range-Planung (src/rangePlanner.js) — reine Rechnung, kein Electron, kein Netz.
// Läuft mit `npm run test:unit`.
//
// Warum genau diese Funktion Tests bekommt: sie rechnet mit Byte-Offsets in eine Zip-Datei hinein.
// Ein Fehler um eins liefert keine Fehlermeldung, sondern eine Datei mit falschem Inhalt, und der
// fällt erst als Prüfsummenfehler beim Nutzer auf.
const { test } = require("node:test")
const assert = require("node:assert")
const { planRanges, mergeWithGap } = require("../src/rangePlanner")

/** Baut einen Manifest-Eintrag mit den Feldern, die die Planung liest. */
function entry(path, offset, compressedSize) {
	return { path, offset, compressedSize, sha256: "x".repeat(64), mode: 0o644, compressionMethod: 8, size: compressedSize }
}

test("lückenlos aufeinanderfolgende Einträge ergeben EINEN Lauf", () => {
	const plan = planRanges([entry("a", 0, 100), entry("b", 100, 50), entry("c", 150, 25)], 100000)
	assert.equal(plan.mode, "runs")
	assert.equal(plan.runs.length, 1)
	assert.equal(plan.runs[0].start, 0)
	assert.equal(plan.runs[0].end, 174) // 150 + 25 - 1, inklusiv
	assert.equal(plan.runs[0].entries.length, 3)
	assert.equal(plan.wasteBytes, 0)
	assert.equal(plan.payloadBytes, 175)
})

test("eine Lücke oberhalb der Toleranz trennt die Läufe", () => {
	// Zip groß genug, dass weder die Ganz-Zip-Schwelle noch das Verschmelzen greifen.
	const plan = planRanges([entry("a", 0, 100), entry("b", 5 * 1024 * 1024, 100)], 500 * 1024 * 1024, { gapBytes: 1024 })
	assert.equal(plan.runs.length, 2)
	assert.equal(plan.wasteBytes, 0)
})

test("eine Lücke innerhalb der Toleranz wird mitgeladen und als Verschwendung gezählt", () => {
	const plan = planRanges([entry("a", 0, 100), entry("b", 600, 100)], 10 * 1024 * 1024, { gapBytes: 1024 })
	assert.equal(plan.runs.length, 1)
	assert.equal(plan.runs[0].start, 0)
	assert.equal(plan.runs[0].end, 699)
	assert.equal(plan.wasteBytes, 500) // 600 - (99 + 1)
	assert.equal(plan.payloadBytes, 200)
})

test("die Einträge eines Laufs bleiben nach Offset sortiert, auch bei unsortierter Eingabe", () => {
	const plan = planRanges([entry("c", 200, 10), entry("a", 0, 10), entry("b", 100, 10)], 1e6, { gapBytes: 1e6 })
	assert.equal(plan.runs.length, 1)
	assert.deepEqual(
		plan.runs[0].entries.map(e => e.path),
		["a", "b", "c"],
	)
})

test("zu viele Läufe ⇒ die Toleranz wächst, bis das Ziel erreicht ist", () => {
	// 200 Einträge à 10 Bytes, je 2000 Bytes auseinander. Mit 1 KiB Toleranz wären das 200 Läufe.
	const entries = []
	for (let i = 0; i < 200; i++) entries.push(entry("f" + i, i * 2000, 10))
	const zipSize = 100 * 1024 * 1024 // Budget großzügig ⇒ Verschmelzen erlaubt
	const plan = planRanges(entries, zipSize, { gapBytes: 1024 })
	assert.equal(plan.mode, "runs")
	assert.ok(plan.runs.length <= 64, `erwartet höchstens 64 Läufe, bekommen ${plan.runs.length}`)
	assert.ok(plan.wasteBytes > 0, "das Verschmelzen muss Lückenbytes mitziehen")
})

test("das Verschwendungsbudget begrenzt das Verschmelzen", () => {
	// Dieselbe Streuung, aber ein winziges Zip: das Budget (15 %) ist sofort erschöpft, also darf
	// NICHT weiter verschmolzen werden — lieber viele Anfragen als das halbe Zip mitzuladen.
	const entries = []
	for (let i = 0; i < 200; i++) entries.push(entry("f" + i, i * 2000, 10))
	const plan = planRanges(entries, 400000, { gapBytes: 100, wholeZipFraction: 10 })
	assert.equal(plan.mode, "runs")
	assert.ok(plan.wasteBytes <= 400000 * 0.15, `Verschwendung ${plan.wasteBytes} überschreitet das Budget`)
	assert.ok(plan.runs.length > 64, "hier ist die Anfragenzahl bewusst NICHT das oberste Ziel")
})

test("deckt das Delta den Großteil des Zips ab, wird das ganze Zip geholt", () => {
	// 7 von 10 MB geändert ⇒ Stückeln lohnt nicht mehr.
	const plan = planRanges([entry("a", 0, 7 * 1024 * 1024)], 10 * 1024 * 1024)
	assert.equal(plan.mode, "whole-zip")
	assert.match(plan.reason, /70 %/)
})

test("unbekannte Zip-Größe schaltet die Ganz-Zip-Schwelle ab", () => {
	// Ohne Bezugsgröße lässt sich „lohnt sich das noch?" nicht beantworten — dann wird gestückelt.
	const plan = planRanges([entry("a", 0, 999999)], 0)
	assert.equal(plan.mode, "runs")
	assert.equal(plan.runs.length, 1)
})

test("leere Dateien werden ausgesondert und erzeugen keinen Bereich", () => {
	// Das ist der Fehler, der bis eben ein ganzes 4-GiB-Zip kosten konnte: ein Eintrag mit
	// compressedSize 0 hätte `Range: bytes=100-99` ergeben ⇒ 416 ⇒ „Range nicht unterstützt".
	const plan = planRanges([entry("gitkeep", 100, 0), entry("a", 200, 50)], 1e6)
	assert.equal(plan.mode, "runs")
	assert.equal(plan.empty.length, 1)
	assert.equal(plan.empty[0].path, "gitkeep")
	assert.equal(plan.runs.length, 1)
	assert.equal(plan.runs[0].start, 200)
	assert.equal(plan.runs[0].end, 249)
})

test("nur leere Dateien ⇒ gar keine Anfrage", () => {
	const plan = planRanges([entry("a", 0, 0), entry("b", 10, 0)], 1e6)
	assert.equal(plan.mode, "runs")
	assert.equal(plan.runs.length, 0)
	assert.equal(plan.empty.length, 2)
})

test("leere Eingabe ist kein Sonderfall", () => {
	const plan = planRanges([], 1e6)
	assert.equal(plan.mode, "runs")
	assert.equal(plan.runs.length, 0)
	assert.equal(plan.empty.length, 0)
})

test("ein Lauf wird nie größer als MAX_RUN_BYTES", () => {
	// Zwei je 200 MB große, direkt benachbarte Einträge dürfen nicht zu einem 400-MB-Lauf werden:
	// ein Abbruch kurz vor dem Ende verwürfe sonst zu viel.
	const big = 200 * 1024 * 1024
	const plan = planRanges([entry("a", 0, big), entry("b", big, big)], 10 * 1024 * 1024 * 1024)
	assert.equal(plan.mode, "runs")
	assert.equal(plan.runs.length, 2)
})

test("mergeWithGap rechnet die Grenze exakt (Lücke == Toleranz verschmilzt noch)", () => {
	// Ende von a ist Byte 99, b beginnt bei 200 ⇒ Lücke = 100.
	const exact = mergeWithGap([entry("a", 0, 100), entry("b", 200, 10)], 100)
	assert.equal(exact.runs.length, 1)
	assert.equal(exact.wasteBytes, 100)
	const tooBig = mergeWithGap([entry("a", 0, 100), entry("b", 200, 10)], 99)
	assert.equal(tooBig.runs.length, 2)
	assert.equal(tooBig.wasteBytes, 0)
})
