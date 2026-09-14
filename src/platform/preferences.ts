export const PREFERENCES_KEY = 'wandering-path.preferences';

export interface Preferences {
  music: number;
  soundEffects: number;
  reducedMotion: boolean;
  screenShake: boolean;
}

export const defaultPreferences = (): Preferences => ({
  music: 0.8,
  soundEffects: 0.8,
  reducedMotion: false,
  screenShake: true,
});

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const volume = (value: unknown) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

export function decodePreferences(raw: string): Preferences {
  const value = JSON.parse(raw) as Partial<Preferences>;
  if (
    !value ||
    !volume(value.music) ||
    !volume(value.soundEffects) ||
    typeof value.reducedMotion !== 'boolean' ||
    typeof value.screenShake !== 'boolean'
  )
    throw new Error('Invalid preferences');
  return value as Preferences;
}

export function loadPreferences(storage: PreferenceStorage) {
  try {
    const raw = storage.getItem(PREFERENCES_KEY);
    return raw ? decodePreferences(raw) : defaultPreferences();
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(
  storage: PreferenceStorage,
  preferences: Preferences,
) {
  const normalized = decodePreferences(JSON.stringify(preferences));
  storage.setItem(PREFERENCES_KEY, JSON.stringify(normalized));
}
