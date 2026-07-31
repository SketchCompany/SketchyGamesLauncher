import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tailwind-Klassen zusammenführen (shadcn-Konvention). */
export function cn(...inputs) {
	return twMerge(clsx(inputs))
}

/**
 * Passwort-Policy 1:1 wie die API (api/functions.js → isStrongPassword):
 * 8–72 Zeichen (72 = bcrypt-Bytelimit), mindestens ein Buchstabe und mindestens eine Ziffer.
 * Gibt eine deutsche Fehlermeldung zurück oder null, wenn das Passwort die Policy erfüllt.
 */
export function passwordProblem(pw) {
	const value = String(pw ?? "")
	if (value.length < 8) return "Das Passwort muss mindestens 8 Zeichen haben."
	if (value.length > 72) return "Das Passwort darf höchstens 72 Zeichen haben."
	if (!/[A-Za-z]/.test(value)) return "Das Passwort muss mindestens einen Buchstaben enthalten."
	if (!/[0-9]/.test(value)) return "Das Passwort muss mindestens eine Ziffer enthalten."
	return null
}
