import { afterEach, beforeEach, vi } from 'vitest';

// The suite deliberately exercises failure paths (dead feeds, corrupt
// storage, invalid payloads), and the code under test logs those via
// console.error/warn by design. Silence the expected noise so genuine
// failures — assertion errors, which vitest prints itself — stand out.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});
