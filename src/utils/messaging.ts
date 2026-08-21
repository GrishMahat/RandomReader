import type { ExtensionMessage, MessageResponses } from '../models';

/**
 * Sends a message to the background service worker and returns the response
 * declared in MessageResponses for this request type. Handles
 * `chrome.runtime.lastError` so callers always get a structured result
 * instead of a silent undefined when the service worker is not yet active.
 */
export function sendMessage<K extends keyof MessageResponses>(
  message: ExtensionMessage & { type: K },
): Promise<MessageResponses[K]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: unknown) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message } as MessageResponses[K]);
        return;
      }
      resolve((response ?? { success: false, error: 'No response from background' }) as MessageResponses[K]);
    });
  });
}
