const TOKEN_KEY = "mealmap_token";
const USER_KEY = "mealmap_user";
const HOUSEHOLD_KEY = "mealmap_household";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: any, household: any) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(HOUSEHOLD_KEY, JSON.stringify(household));
}

export function getStoredUser(): any {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getStoredHousehold(): any {
  const raw = localStorage.getItem(HOUSEHOLD_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(HOUSEHOLD_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
