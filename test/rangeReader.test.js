// Tests des Auftrennens gebündelter Range-Antworten (src/rangeReader.js).
//
// Das hier ist der riskanteste Teil des Delta-Downloads: er schneidet aus EINEM Bytestrom die
// einzelnen Dateien heraus. Ein Fehler um eins wirft keine Ausnahme, sondern legt eine Datei mit
// falschem Inhalt ab — auffallen würde das erst über die Prüfsumme beim Nutzer.
//
// Getestet wird gegen einen echten, von Hand gebauten Zip-Datenbereich (roh gespeichert und
// deflate-komprimiert gemischt), nicht gegen eine Nachbildung.
const { test } = require("node:test")
const assert = require("node:assert")
const os = require("node:os")
const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")
const crypto = require("node:crypto")
const { Readable } = require("node:stream")
const { makeReader, splitRun, ShortReadError } = require("../src/rangeReader")

const sha256 = b => crypto.createHash("sha256").update(b).digest("hex")

/**
 * Baut einen Byte-Puffer, der wie der Datenbereich eines Zips aussieht: Füllbytes (die lokalen
 * Dateiköpfe, die der Launcher überspringt), dann die Nutzdaten der Einträge.
 * @returns {{buffer: Buffer, entries: Array}}
 */
function buildZipLike(specs) {
	const parts = []
	const entries = []
	let offset = 0
	for (const spec of specs) {
		const filler = Buffer.alloc(spec.gap || 0, 0x2e) // steht für den lokalen Dateikopf
		parts.push(filler)
		offset += filler.length

		const raw = Buffer.from(spec.content)
		const stored = spec.deflate ? zlib.deflateRawSync(raw) : raw
		entries.push({
			path: spec.path,
			offset,
			compressedSize: stored.length,
			compressionMethod: spec.deflate ? 8 : 0,
			sha256: sha256(raw), // das Manifest hasht den ENTPACKTEN Inhalt
			mode: 0o644,
			size: raw.length,
			expected: raw,
		})
		parts.push(stored)
		offset += stored.length
	}
	return { buffer: Buffer.concat(parts), entries }
}

/** Stellt einen Range-Request nach: liefert genau [start, end] in kleinen Häppchen. */
function rangeStream(buffer, start, end, chunkSize = 7) {
	const slice = buffer.subarray(start, end + 1)
	const chunks = []
	for (let i = 0; i < slice.length; i += chunkSize) chunks.push(slice.subarray(i, i + chunkSize))
	return Readable.from(chunks)
}

function tmpDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), "sgl-reader-"))
}

test("trennt einen Lauf aus mehreren Dateien korrekt auf (roh + deflate gemischt)", async () => {
	const { buffer, entries } = buildZipLike([
		{ path: "a.txt", content: "Hallo Welt", gap: 30, deflate: false },
		{ path: "sub/b.bin", content: "B".repeat(5000), gap: 34, deflate: true },
		{ path: "c.txt", content: "letzte Datei", gap: 30, deflate: false },
	])
	const run = { start: entries[0].offset, end: entries[2].offset + entries[2].compressedSize - 1, entries }
	const dir = tmpDir()
	try {
		const done = []
		const reader = makeReader(rangeStream(buffer, run.start, run.end))
		await splitRun(reader, run, dir, { onEntryDone: async e => done.push(e.path) })

		assert.deepStrictEqual(done, ["a.txt", "sub/b.bin", "c.txt"])
		for (const e of entries) {
			const written = fs.readFileSync(path.resolve(dir, e.path))
			assert.ok(written.equals(e.expected), `Inhalt von ${e.path} weicht ab`)
		}
		assert.strictEqual(fs.existsSync(path.resolve(dir, "a.txt.sgl-part")), false, "die .sgl-part darf nicht liegen bleiben")
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test("überspringt die Lücken zwischen den Einträgen exakt", async () => {
	// Der eigentliche Grund für diese Datei: die Lückenbytes zwischen den Einträgen (lokale
	// Dateiköpfe und bewusst mitgeladene unveränderte Daten) müssen exakt verworfen werden. Ein Byte
	// zu viel oder zu wenig verschiebt ALLE folgenden Dateien.
	const { buffer, entries } = buildZipLike([
		{ path: "erste", content: "1234567890", gap: 0, deflate: false },
		{ path: "zweite", content: "abcdefghij", gap: 999, deflate: false },
	])
	const run = { start: entries[0].offset, end: entries[1].offset + entries[1].compressedSize - 1, entries }
	const dir = tmpDir()
	try {
		const reader = makeReader(rangeStream(buffer, run.start, run.end, 13))
		await splitRun(reader, run, dir)
		assert.strictEqual(fs.readFileSync(path.resolve(dir, "erste"), "utf8"), "1234567890")
		assert.strictEqual(fs.readFileSync(path.resolve(dir, "zweite"), "utf8"), "abcdefghij")
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test("ein Lauf, der nicht bei 0 beginnt, wird richtig ausgerichtet", async () => {
	// Genau der Fall aus rangePlanner.js: die Läufe beginnen fast nie am Dateianfang, und `run.start`
	// ist der Bezugspunkt für alle Offsets.
	const { buffer, entries } = buildZipLike([
		{ path: "ignoriert", content: "X".repeat(400), gap: 50, deflate: false },
		{ path: "gewollt", content: "Nutzdaten", gap: 30, deflate: false },
	])
	const target = entries[1]
	const run = { start: target.offset, end: target.offset + target.compressedSize - 1, entries: [target] }
	const dir = tmpDir()
	try {
		const reader = makeReader(rangeStream(buffer, run.start, run.end))
		await splitRun(reader, run, dir)
		assert.strictEqual(fs.readFileSync(path.resolve(dir, "gewollt"), "utf8"), "Nutzdaten")
		assert.strictEqual(fs.existsSync(path.resolve(dir, "ignoriert")), false)
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test("eine falsche Prüfsumme wird abgewiesen und hinterlässt nichts", async () => {
	const { buffer, entries } = buildZipLike([{ path: "kaputt", content: "Inhalt", gap: 10, deflate: false }])
	entries[0].sha256 = "0".repeat(64)
	const run = { start: entries[0].offset, end: entries[0].offset + entries[0].compressedSize - 1, entries }
	const dir = tmpDir()
	try {
		const reader = makeReader(rangeStream(buffer, run.start, run.end))
		await assert.rejects(() => splitRun(reader, run, dir), /Prüfsumme weicht ab/)
		assert.strictEqual(fs.existsSync(path.resolve(dir, "kaputt")), false)
		assert.strictEqual(fs.existsSync(path.resolve(dir, "kaputt.sgl-part")), false)
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test("ein zu früh endender Strom liefert ShortReadError (⇒ Wiederholung, kein Ganz-Zip)", async () => {
	const { buffer, entries } = buildZipLike([{ path: "abgeschnitten", content: "Y".repeat(200), gap: 10, deflate: false }])
	const run = { start: entries[0].offset, end: entries[0].offset + entries[0].compressedSize - 1, entries }
	const dir = tmpDir()
	try {
		// Absichtlich 50 Bytes zu wenig ausliefern.
		const reader = makeReader(rangeStream(buffer, run.start, run.end - 50))
		await assert.rejects(() => splitRun(reader, run, dir), ShortReadError)
		assert.strictEqual(fs.existsSync(path.resolve(dir, "abgeschnitten")), false)
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test("beforeChunk wird vor jedem Nachschub aufgerufen (Pause/Abbruch hängen daran)", async () => {
	const { buffer, entries } = buildZipLike([{ path: "d", content: "Z".repeat(100), gap: 0, deflate: false }])
	const run = { start: 0, end: buffer.length - 1, entries }
	const dir = tmpDir()
	try {
		let calls = 0
		const reader = makeReader(rangeStream(buffer, 0, buffer.length - 1, 10), { beforeChunk: async () => void calls++ })
		await splitRun(reader, run, dir)
		assert.ok(calls >= 10, `erwartet mindestens einen Aufruf je Chunk, bekommen ${calls}`)
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test("onProgress zählt die WIRKLICH übertragenen Bytes, inklusive der Lücken", async () => {
	// Die Fortschrittsanzeige rechnet mit Nutzlast + mitgeladenen Lückenbytes; würden die Lücken
	// nicht gezählt, bliebe der Balken vor 100 % stehen.
	const { buffer, entries } = buildZipLike([
		{ path: "e1", content: "1234", gap: 20, deflate: false },
		{ path: "e2", content: "5678", gap: 60, deflate: false },
	])
	const run = { start: entries[0].offset, end: entries[1].offset + entries[1].compressedSize - 1, entries }
	const dir = tmpDir()
	try {
		let bytes = 0
		const reader = makeReader(rangeStream(buffer, run.start, run.end, 5), { onProgress: n => (bytes += n) })
		await splitRun(reader, run, dir)
		assert.strictEqual(bytes, run.end - run.start + 1)
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})

test("eine vorhandene Datei wird ersetzt (Update-Fall)", async () => {
	const { buffer, entries } = buildZipLike([{ path: "vorhanden", content: "neu", gap: 8, deflate: false }])
	const run = { start: entries[0].offset, end: entries[0].offset + entries[0].compressedSize - 1, entries }
	const dir = tmpDir()
	try {
		fs.writeFileSync(path.resolve(dir, "vorhanden"), "alt")
		const reader = makeReader(rangeStream(buffer, run.start, run.end))
		await splitRun(reader, run, dir)
		assert.strictEqual(fs.readFileSync(path.resolve(dir, "vorhanden"), "utf8"), "neu")
	}
	finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
})
