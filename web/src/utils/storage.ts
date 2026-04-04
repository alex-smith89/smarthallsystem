import type { User } from '../types';

const TOKEN_KEY = 'smart_exam_token';
const USER_KEY = 'smart_exam_user';
const OFFLINE_QUEUE_KEY = 'smart_exam_offline_queue';

type OfflineQueueMap = Record<string, string[]>;

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage write errors
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage remove errors
  }
}

export function saveAuthSession(token: string, user: User): void {
  safeWrite(TOKEN_KEY, token);
  safeWrite(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  safeRemove(TOKEN_KEY);
  safeRemove(USER_KEY);
}

export function getStoredToken(): string | null {
  const token = safeRead(TOKEN_KEY);
  return token && token.trim() ? token : null;
}

export function getStoredUser(): User | null {
  const raw = safeRead(USER_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as User;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed._id ||
      !parsed.name ||
      !parsed.email ||
      !parsed.role
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function readOfflineQueueMap(): OfflineQueueMap {
  const raw = safeRead(OFFLINE_QUEUE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as OfflineQueueMap;

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const cleaned: OfflineQueueMap = {};

    Object.entries(parsed).forEach(([examId, values]) => {
      if (!Array.isArray(values)) return;

      const sanitized = values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);

      cleaned[examId] = Array.from(new Set(sanitized));
    });

    return cleaned;
  } catch {
    return {};
  }
}

function writeOfflineQueueMap(value: OfflineQueueMap): void {
  safeWrite(OFFLINE_QUEUE_KEY, JSON.stringify(value));
}

export function getOfflineQueue(examId: string): string[] {
  if (!examId.trim()) return [];

  const map = readOfflineQueueMap();
  return map[examId] ?? [];
}

export function setOfflineQueue(examId: string, values: string[]): void {
  if (!examId.trim()) return;

  const map = readOfflineQueueMap();

  const cleaned = Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (cleaned.length === 0) {
    delete map[examId];
  } else {
    map[examId] = cleaned;
  }

  writeOfflineQueueMap(map);
}

export function enqueueOfflineScan(examId: string, qrCodeValue: string): void {
  if (!examId.trim() || !qrCodeValue.trim()) return;

  const current = new Set(getOfflineQueue(examId));
  current.add(qrCodeValue.trim());
  setOfflineQueue(examId, Array.from(current));
}

export function dequeueOfflineScan(examId: string, qrCodeValue: string): void {
  if (!examId.trim() || !qrCodeValue.trim()) return;

  const next = getOfflineQueue(examId).filter((item) => item !== qrCodeValue.trim());
  setOfflineQueue(examId, next);
}

export function clearOfflineQueue(examId: string): void {
  if (!examId.trim()) return;

  const map = readOfflineQueueMap();
  delete map[examId];
  writeOfflineQueueMap(map);
}

export function getAllOfflineQueues(): OfflineQueueMap {
  return readOfflineQueueMap();
}

export function clearAllOfflineQueues(): void {
  safeRemove(OFFLINE_QUEUE_KEY);
}