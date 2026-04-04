import type { User } from '../types';

const TOKEN_KEY = 'smart_exam_token';
const USER_KEY = 'smart_exam_user';
const OFFLINE_QUEUE_KEY = 'smart_exam_offline_queue';

type OfflineQueueMap = Record<string, string[]>;

export function saveAuthSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function readOfflineQueueMap(): OfflineQueueMap {
  const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as OfflineQueueMap;
  } catch {
    return {};
  }
}

function writeOfflineQueueMap(value: OfflineQueueMap): void {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(value));
}

export function getOfflineQueue(examId: string): string[] {
  const map = readOfflineQueueMap();
  return map[examId] ?? [];
}

export function setOfflineQueue(examId: string, values: string[]): void {
  const map = readOfflineQueueMap();
  map[examId] = values;
  writeOfflineQueueMap(map);
}

export function enqueueOfflineScan(examId: string, qrCodeValue: string): void {
  const current = new Set(getOfflineQueue(examId));
  current.add(qrCodeValue);
  setOfflineQueue(examId, Array.from(current));
}

export function clearOfflineQueue(examId: string): void {
  const map = readOfflineQueueMap();
  delete map[examId];
  writeOfflineQueueMap(map);
}