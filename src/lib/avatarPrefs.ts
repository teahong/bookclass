export interface AvatarPref {
  icon: AvatarIconKey;
  color: string;
}

const AVATAR_STORAGE_KEY = 'bookClassAvatarPrefs';

export const AVATAR_ICON_KEYS = [
  'glasses',
  'sun',
  'rocket',
  'sprout',
  'user',
  'book',
  'star',
  'heart',
  'smile',
  'cat',
  'dog',
  'bird',
  'fish',
  'tree_pine',
  'flower',
  'leaf',
  'flame',
  'sparkles',
  'crown',
  'shield',
  'graduation_cap',
  'pencil',
  'ruler',
  'calculator',
  'music',
  'camera',
  'gamepad',
  'dumbbell',
  'palette',
  'lightbulb'
] as const;

export type AvatarIconKey = (typeof AVATAR_ICON_KEYS)[number];

export const AVATAR_COLORS = [
  '#5D4037',
  '#FFB74D',
  '#4DB6AC',
  '#81C784',
  '#64B5F6',
  '#BA68C8',
  '#FF8A65',
  '#90A4AE'
];

const getStableIndex = (value: string, mod: number) => {
  return [...value].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % mod;
};

export const getDefaultAvatarPref = (id: string, name: string): AvatarPref => {
  const base = id || name || 'default';
  return {
    icon: AVATAR_ICON_KEYS[getStableIndex(base, AVATAR_ICON_KEYS.length)],
    color: AVATAR_COLORS[getStableIndex(base, AVATAR_COLORS.length)]
  };
};

const readAvatarPrefMap = (): Record<string, AvatarPref> => {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return {};
  } catch {
    return {};
  }
};

export const getAvatarPrefFromLocal = (name: string): AvatarPref | null => {
  const pref = readAvatarPrefMap()[name];
  if (!pref) return null;
  if (!pref.icon || !pref.color) return null;
  return pref;
};

export const saveAvatarPrefToLocal = (name: string, pref: AvatarPref) => {
  const map = readAvatarPrefMap();
  map[name] = pref;
  localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(map));
};
