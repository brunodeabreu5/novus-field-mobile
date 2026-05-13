let currentExpoPushToken: string | null = null;

export function getRegisteredExpoPushToken() {
  return currentExpoPushToken;
}

export function setRegisteredExpoPushToken(token: string | null) {
  currentExpoPushToken = token;
}

export function clearRegisteredExpoPushToken() {
  currentExpoPushToken = null;
}
