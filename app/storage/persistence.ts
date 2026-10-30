export type StorageStatus = 'kept' | 'may-clear'

/** Asks the browser not to clear the app's data when space runs low. It may still say no. */
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persist'> | undefined = navigator.storage,
): Promise<StorageStatus> {
  try {
    return (await storage?.persist()) ? 'kept' : 'may-clear'
  } catch {
    return 'may-clear'
  }
}
