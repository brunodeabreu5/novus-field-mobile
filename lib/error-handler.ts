import { Alert, Linking, Platform } from "react-native";

// Error types for better handling
export interface AppError {
  message: string;
  status?: number;
  code?: string;
  isRetryable?: boolean;
}

// Map API errors to user-friendly messages
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for specific error patterns
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch")) {
      return "Error de conexión. Verifique sua internet.";
    }

    if (message.includes("timeout") || message.includes("timed out")) {
      return "Tempo agotado. Tente novamente.";
    }

    if (message.includes("401") || message.includes("unauthorized") || message.includes("sesión")) {
      return "Sesión expirada. Faça login novamente.";
    }

    if (message.includes("403") || message.includes("forbidden")) {
      return "Você não tem permissão para esta ação.";
    }

    if (message.includes("404") || message.includes("not found")) {
      return "Recurso não encontrado.";
    }

    if (message.includes("500") || message.includes("server error")) {
      return "Erro do servidor. Tente novamente mais tarde.";
    }

    if (message.includes("no internet") || message.includes("offline")) {
      return "Sem conexão. Os dados serão sincronizados depois.";
    }

    // Return the original message if no pattern matches
    return error.message;
  }

  return "Ocorreu um erro inesperado.";
}

// Check if error is retryable
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("fetch") ||
      message.includes("econnreset") ||
      message.includes("etimedout")
    );
  }
  return false;
}

// Show error alert with retry option
export function showError(
  error: unknown,
  title = "Erro",
  onRetry?: () => void,
): void {
  const message = getErrorMessage(error);
  const retryable = isRetryableError(error);

  if (retryable && onRetry) {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Tentar novamente", onPress: onRetry },
      ],
    );
  } else {
    Alert.alert(title, message);
  }
}

// Show success notification
export function showSuccess(message: string): void {
  Alert.alert("✅ Sucesso", message);
}

// Show info notification
export function showInfo(title: string, message: string): void {
  Alert.alert(title, message);
}

// Show warning notification
export function showWarning(title: string, message: string): void {
  Alert.alert(`⚠️ ${title}`, message);
}

// Show confirmation dialog
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
): void {
  Alert.alert(
    title,
    message,
    [
      { text: cancelText, style: "cancel" },
      { text: confirmText, onPress: onConfirm, style: "destructive" },
    ],
  );
}

// Open device settings
export function openSettings(): void {
  if (Platform.OS === "ios") {
    Linking.openURL("app-settings:");
  } else {
    Linking.openSettings();
  }
}

// Show permission denied alert
export function showPermissionDenied(
  permission: string,
  message: string,
): void {
  Alert.alert(
    `Permissão ${permission} requerida`,
    message,
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Abrir Configurações", onPress: openSettings },
    ],
  );
}

// Format error for logging
export function formatErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ""}`;
  }
  return String(error);
}

// Log error to console with context
export function logError(context: string, error: unknown): void {
  console.error(`[${context}] Error:`, formatErrorForLog(error));
}
