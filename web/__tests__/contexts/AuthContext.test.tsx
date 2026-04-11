import renderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/lib/api';
import {
  clearAuthSession,
  getStoredToken,
  getStoredUser,
  saveAuthSession
} from '../../src/utils/storage';

jest.mock('../../src/lib/api', () => ({
  api: {
    login: jest.fn(),
    getProfile: jest.fn()
  }
}));

jest.mock('../../src/utils/storage', () => ({
  clearAuthSession: jest.fn(),
  getStoredToken: jest.fn(),
  getStoredUser: jest.fn(),
  saveAuthSession: jest.fn()
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedClearAuthSession = clearAuthSession as jest.MockedFunction<typeof clearAuthSession>;
const mockedGetStoredToken = getStoredToken as jest.MockedFunction<typeof getStoredToken>;
const mockedGetStoredUser = getStoredUser as jest.MockedFunction<typeof getStoredUser>;
const mockedSaveAuthSession = saveAuthSession as jest.MockedFunction<typeof saveAuthSession>;

let latestAuth: ReturnType<typeof useAuth> | null = null;

function AuthConsumer() {
  latestAuth = useAuth();
  return null;
}

async function renderProvider() {
  let tree!: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return tree;
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestAuth = null;
    mockedGetStoredUser.mockReturnValue(null);
    mockedGetStoredToken.mockReturnValue(null);
  });

  test('refreshes the stored session on mount when a token exists', async () => {
    mockedGetStoredToken.mockReturnValue('stored-token');
    mockedApi.getProfile.mockResolvedValue({
      data: {
        _id: 'user_1',
        name: 'Aayan',
        email: 'aayan@example.com',
        role: 'admin'
      }
    } as any);

    await renderProvider();

    expect(mockedApi.getProfile).toHaveBeenCalledTimes(1);
    expect(mockedSaveAuthSession).toHaveBeenCalledWith('stored-token', {
      _id: 'user_1',
      name: 'Aayan',
      email: 'aayan@example.com',
      role: 'admin'
    });
    expect(latestAuth?.isAuthenticated).toBe(true);
    expect(latestAuth?.loading).toBe(false);
  });

  test('sets authenticated state on successful login', async () => {
    mockedApi.login.mockResolvedValue({
      data: {
        token: 'login-token',
        user: {
          _id: 'user_1',
          name: 'Aayan',
          email: 'aayan@example.com',
          role: 'admin'
        }
      }
    } as any);

    await renderProvider();

    await act(async () => {
      await latestAuth?.login('aayan@example.com', 'secret123');
    });

    expect(mockedApi.login).toHaveBeenCalledWith('aayan@example.com', 'secret123');
    expect(mockedSaveAuthSession).toHaveBeenCalledWith('login-token', {
      _id: 'user_1',
      name: 'Aayan',
      email: 'aayan@example.com',
      role: 'admin'
    });
    expect(latestAuth?.token).toBe('login-token');
    expect(latestAuth?.user).toEqual({
      _id: 'user_1',
      name: 'Aayan',
      email: 'aayan@example.com',
      role: 'admin'
    });
    expect(latestAuth?.loading).toBe(false);
  });

  test('clears session and rethrows when login fails', async () => {
    const error = new Error('Invalid credentials');
    mockedApi.login.mockRejectedValue(error);

    await renderProvider();

    await expect(
      act(async () => {
        await latestAuth?.login('aayan@example.com', 'wrong-password');
      })
    ).rejects.toThrow('Invalid credentials');

    expect(mockedClearAuthSession).toHaveBeenCalledTimes(1);
    expect(latestAuth?.user).toBeNull();
    expect(latestAuth?.token).toBeNull();
    expect(latestAuth?.loading).toBe(false);
  });

  test('logout clears the session and resets auth state', async () => {
    mockedGetStoredUser.mockReturnValue({
      _id: 'user_1',
      name: 'Aayan',
      email: 'aayan@example.com',
      role: 'admin'
    });
    mockedGetStoredToken.mockReturnValue('stored-token');
    mockedApi.getProfile.mockResolvedValue({
      data: {
        _id: 'user_1',
        name: 'Aayan',
        email: 'aayan@example.com',
        role: 'admin'
      }
    } as any);

    await renderProvider();

    act(() => {
      latestAuth?.logout();
    });

    expect(mockedClearAuthSession).toHaveBeenCalledTimes(1);
    expect(latestAuth?.user).toBeNull();
    expect(latestAuth?.token).toBeNull();
    expect(latestAuth?.isAuthenticated).toBe(false);
    expect(latestAuth?.loading).toBe(false);
  });
});