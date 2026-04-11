import {
  clearAllOfflineQueues,
  clearAuthSession,
  clearOfflineQueue,
  dequeueOfflineScan,
  enqueueOfflineScan,
  getAllOfflineQueues,
  getOfflineQueue,
  getStoredToken,
  getStoredUser,
  saveAuthSession,
  setOfflineQueue
} from '../../src/utils/storage';

const createUser = () => ({
  _id: 'user_1',
  name: 'Aayan',
  email: 'aayan@example.com',
  role: 'admin' as const
});

describe('storage utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('saves, reads, and clears auth session data', () => {
    saveAuthSession('token_123', createUser());

    expect(getStoredToken()).toBe('token_123');
    expect(getStoredUser()).toEqual(createUser());

    clearAuthSession();

    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  test('returns null for malformed stored user payloads', () => {
    localStorage.setItem('smart_exam_user', '{bad json');
    expect(getStoredUser()).toBeNull();

    localStorage.setItem(
      'smart_exam_user',
      JSON.stringify({ _id: 'user_1', email: 'aayan@example.com' })
    );
    expect(getStoredUser()).toBeNull();
  });

  test('sanitizes and de-duplicates offline queue values', () => {
    setOfflineQueue('exam_1', [' qr-1 ', 'qr-1', '', 'qr-2']);

    expect(getOfflineQueue('exam_1')).toEqual(['qr-1', 'qr-2']);

    enqueueOfflineScan('exam_1', ' qr-3 ');
    enqueueOfflineScan('exam_1', 'qr-2');

    expect(getOfflineQueue('exam_1')).toEqual(['qr-1', 'qr-2', 'qr-3']);

    dequeueOfflineScan('exam_1', ' qr-2 ');
    expect(getOfflineQueue('exam_1')).toEqual(['qr-1', 'qr-3']);
  });

  test('clears one exam queue or every offline queue', () => {
    setOfflineQueue('exam_1', ['qr-1']);
    setOfflineQueue('exam_2', ['qr-2']);

    clearOfflineQueue('exam_1');
    expect(getAllOfflineQueues()).toEqual({ exam_2: ['qr-2'] });

    clearAllOfflineQueues();
    expect(getAllOfflineQueues()).toEqual({});
  });
});