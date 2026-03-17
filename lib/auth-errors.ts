export function isExpectedAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim().toLowerCase();
  return (
    message === "unauthorized" ||
    message === "no active backend session" ||
    message === "http 401"
  );
}
