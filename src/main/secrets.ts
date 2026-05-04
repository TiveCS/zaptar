import { safeStorage } from 'electron'

export function encryptPassword(password: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: base64 only (no OS keychain available — dev env without a keyring)
    return Buffer.from(password, 'utf8').toString('base64')
  }
  return safeStorage.encryptString(password).toString('base64')
}

export function decryptPassword(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encrypted, 'base64').toString('utf8')
  }
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
}
