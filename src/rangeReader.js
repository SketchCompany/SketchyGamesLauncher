// rangeReader.js — trennt EINEN zusammenhängend geladenen Byte-Bereich wieder in die einzelnen
// Dateien auf, die er enthält.
//
// Gehört zu rangePlanner.js: der Planer bündelt benachbarte Manifest-Einträge zu wenigen
// Range-Anfragen, dieses Modul packt das Ergebnis sequenziell wieder aus. Getrennt von
// downloadEngine.js, damit es OHNE Electron testbar ist (test/rangeReader.test.js) — es rechnet mit
// Byte-Offsets in eine Zip-Datei hinein, und ein Fehler um eins liefert keine Fehlermeldung,
// sondern eine Datei mit falschem Inhalt.
//
// Es wird NIE mehr als ein Chunk gepuffert: ein Lauf darf mehrere hundert MB groß sein.
const fs = require("fs")
const path = require("path")
const zlib = require("zlib")
const crypto = require("crypto")
const { PassThrough } = require("stream")

/** Der Strom endete vor dem Ende des angeforderten Bereichs — erneut versuchen, nicht aufgeben. */
class ShortReadError extends Error {}

/**
 * Sequenzieller Leser über einem Readable.
 *
 * @param {import("stream").Readable} stream
 * @param {{onProgress?: (n:number)=>void, beforeChunk?: () => Promise<void>}} hooks
 *   `beforeChunk` läuft vor jedem Nachschub — der Launcher hängt daran Pause und Abbruch auf.
 *   (Über `stream.pause()` ginge das nicht: ein per Async-Iterator gelesener Strom läuft ohnehin
 *   im paused mode und ließe sich damit nicht anhalten.)
 */
function makeReader(stream, hooks = {}) {
	const iter = stream[Symbol.asyncIterator]()
	let buf = Buffer.alloc(0)
	let ended = false

	async function fill() {
		if (ended) return false
		if (hooks.beforeChunk) await hooks.beforeChunk()
		const { value, done } = await iter.next()
		if (done || !value) {
			ended = true
			return false
		}
		if (hooks.onProgress) hooks.onProgress(value.length)
		buf = buf.length ? Buffer.concat([buf, value]) : value
		return true
	}

	async function take(n, onChunk) {
		while (n > 0) {
			if (buf.length === 0 && !(await fill())) throw new ShortReadError("Antwort endete vor dem Ende des Bereichs")
			const size = Math.min(n, buf.length)
			const chunk = buf.subarray(0, size)
			buf = buf.subarray(size)
			n -= size
			if (onChunk) await onChunk(chunk)
		}
	}

	return {
		skip: n => take(n, null),
		read: (n, onChunk) => take(n, onChunk),
		close: () => {
			ended = true
			if (typeof stream.destroy === "function") stream.destroy()
		},
	}
}

/** `stream.write` mit Rückstau — ohne das läuft der Puffer eines Inflate-Streams voll. */
function writeAsync(stream, chunk) {
	return new Promise((resolve, reject) => {
		if (stream.write(chunk)) return resolve()
		stream.once("drain", resolve)
		stream.once("error", reject)
	})
}

/** Verschiebt die fertige `.sgl-part` an ihren Platz (Windows braucht den Umweg über rm). */
async function placePart(partPath, targetPath, mode) {
	if (mode) await fs.promises.chmod(partPath, mode)
	try {
		await fs.promises.rename(partPath, targetPath)
	}
	catch (e) {
		if (e.code === "EEXIST" || e.code === "EPERM") {
			await fs.promises.rm(targetPath, { force: true })
			await fs.promises.rename(partPath, targetPath)
		}
		else throw e
	}
}

/**
 * Schreibt genau EINEN Manifest-Eintrag aus dem laufenden Lesestrom: `compressedSize` Bytes
 * abnehmen, bei Methode 8 entpacken, sha256 des ENTPACKTEN Inhalts prüfen (so steht es im Manifest),
 * dann platzieren. Die Prüfung je Datei ist damit dieselbe wie vor der Bündelung — geteilt ist nur
 * die HTTP-Anfrage.
 *
 * @param {{onWriteStream?: (s:any)=>void}} hooks `onWriteStream` reicht den laufenden Schreibstrom
 *   nach außen, damit ein Abbruch ihn zerstören kann.
 */
async function writeEntryFromReader(reader, entry, targetPath, hooks = {}) {
	const partPath = targetPath + ".sgl-part"
	await fs.promises.mkdir(path.dirname(targetPath), { recursive: true })
	const writeStream = fs.createWriteStream(partPath)
	if (hooks.onWriteStream) hooks.onWriteStream(writeStream)
	const hash = crypto.createHash("sha256")
	const sink = entry.compressionMethod === 8 ? zlib.createInflateRaw() : new PassThrough()
	sink.on("data", chunk => hash.update(chunk))
	const finished = new Promise((resolve, reject) => {
		writeStream.on("finish", resolve)
		writeStream.on("error", reject)
		sink.on("error", reject)
	})
	sink.pipe(writeStream)

	try {
		await reader.read(entry.compressedSize, chunk => writeAsync(sink, chunk))
		sink.end()
		await finished
		if (hooks.onWriteStream) hooks.onWriteStream(null)
		const actual = hash.digest("hex")
		if (actual.toLowerCase() !== String(entry.sha256).toLowerCase()) {
			await fs.promises.rm(partPath, { force: true })
			throw new Error("Prüfsumme weicht ab: " + entry.path)
		}
		await placePart(partPath, targetPath, entry.mode)
	}
	catch (err) {
		if (hooks.onWriteStream) hooks.onWriteStream(null)
		writeStream.destroy()
		sink.destroy()
		await fs.promises.rm(partPath, { force: true }).catch(() => {})
		throw err
	}
}

/**
 * Packt einen ganzen Lauf aus: in Offset-Reihenfolge die Lückenbytes verwerfen (bewusst mitgeladene
 * unveränderte Bytes, siehe rangePlanner.js) und je Eintrag genau seine Bytes herausschneiden.
 *
 * @param {{onEntryDone?: (e:any)=>Promise<void>, beforeEntry?: () => Promise<void>}} hooks
 */
async function splitRun(reader, run, installDir, hooks = {}) {
	let cursor = run.start
	for (const entry of run.entries) {
		if (hooks.beforeEntry) await hooks.beforeEntry()
		if (entry.offset > cursor) {
			await reader.skip(entry.offset - cursor)
			cursor = entry.offset
		}
		const targetPath = path.resolve(installDir, entry.path)
		await writeEntryFromReader(reader, entry, targetPath, hooks)
		cursor += entry.compressedSize
		if (hooks.onEntryDone) await hooks.onEntryDone(entry)
	}
}

module.exports = { makeReader, writeEntryFromReader, splitRun, placePart, ShortReadError }
