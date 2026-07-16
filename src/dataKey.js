const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

/**
 * Manages the per-installation data-encryption key used to obfuscate local data
 * files (settings, user). The key is a random 32-byte value generated on first
 * launch and persisted in the data directory.
 *
 * When the OS keychain is available (Electron ```safeStorage```) the key is
 * stored encrypted with it, so it never lives in plaintext on disk and is not
 * shipped inside the application bundle (unlike the previous hard-coded key).
 * When the keychain is unavailable the key is stored as plaintext hex — in that
 * case the local "encryption" is only obfuscation, never a security boundary.
 */

let cachedKey = null

function keyFilePath(){
    const config = require("./launcherConfig")
    return path.join(config.data, "key.dat")
}

function getSafeStorage(){
    try{
        const { safeStorage } = require("electron")
        if(safeStorage && safeStorage.isEncryptionAvailable()) return safeStorage
    }
    catch(err){ /* not running inside Electron main, or unavailable */ }
    return null
}

/**
 * Returns the 32-byte data-encryption key, loading it from disk or creating and
 * persisting a new one on first use.
 * @returns {Buffer}
 */
function getDataKey(){
    if(cachedKey) return cachedKey
    const file = keyFilePath()
    const safeStorage = getSafeStorage()

    if(fs.existsSync(file)){
        try{
            const stored = fs.readFileSync(file)
            const hex = safeStorage ? safeStorage.decryptString(stored) : stored.toString()
            const key = Buffer.from(hex, "hex")
            if(key.length === 32){
                cachedKey = key
                return cachedKey
            }
        }
        catch(err){
            console.error("dataKey: could not read existing key, generating a new one:", err)
        }
    }

    const key = crypto.randomBytes(32)
    try{
        const payload = safeStorage ? safeStorage.encryptString(key.toString("hex")) : key.toString("hex")
        fs.writeFileSync(file, payload)
    }
    catch(err){
        // Persisting failed — keep the key in memory for this session only. Data
        // written now will not be decryptable next launch (forces re-login),
        // which is acceptable for a local obfuscation store.
        console.error("dataKey: could not persist key, using an in-memory key for this session:", err)
    }
    cachedKey = key
    return cachedKey
}

module.exports = { getDataKey }
