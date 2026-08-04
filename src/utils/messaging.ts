import type { ExtensionMessage } from '../models';

/**
 * Sends a message to the background service worker and returns a typed response.
 * Handles `chrome.runtime.lastError` so callers always get a structured result
 * instead of a silent undefined when the service worker is not yet active.
 */
export function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: unknown) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message } as T);
        return;
      }
      resolve((response ?? { success: false, error: 'No response from background' }) as T);
    });
  });
}
