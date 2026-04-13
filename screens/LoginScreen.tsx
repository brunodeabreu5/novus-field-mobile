import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";

interface LoginScreenProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const { tenant, clearTenant } = useTenant();

  const validate = (): boolean => {
    if (!email.trim()) {
      setError("El correo electronico es obligatorio");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Ingrese un correo electronico valido");
      return false;
    }
    if (!password) {
      setError("La contrasena es obligatoria");
      return false;
    }
    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      await signIn(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Algo salio mal. Intente de nuevo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Image
              source={require("../assets/icon.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>NovusField</Text>
          <Text style={styles.subtitle}>
            Gestion de equipos comerciales en campo
          </Text>
          {tenant ? (
            <View style={styles.tenantCard}>
              <Text style={styles.tenantLabel}>Empresa conectada</Text>
              <Text style={styles.tenantName}>{tenant.displayName}</Text>
              <Text style={styles.tenantMeta}>{tenant.slug}</Text>
              <TouchableOpacity
                style={styles.changeTenantButton}
                onPress={() => {
                  setError(null);
                  void clearTenant();
                }}
              >
                <Text style={styles.changeTenantText}>Cambiar empresa</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Bienvenido de vuelta</Text>
          <Text style={styles.formSubtitle}>
            Ingrese sus credenciales para continuar
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Correo electronico"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Contrasena"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeText}>{showPassword ? "Ocultar" : "Ver"}</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.buttonText}>Iniciar sesion</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = spacing;
const f = fontSize;
const r = radius;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: s.lg,
    paddingTop: s["2xl"] + s.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: s.xl,
  },
  logoBox: {
    width: s["2xl"] + s.lg,
    height: s["2xl"] + s.lg,
    borderRadius: r.lg,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: s.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: s["2xl"],
    height: s["2xl"],
  },
  title: {
    fontSize: f["3xl"],
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: f.md,
    color: colors.mutedForeground,
  },
  tenantCard: {
    marginTop: s.lg,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    backgroundColor: colors.card,
    padding: s.md,
  },
  tenantLabel: {
    fontSize: f.xs,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: s.xs,
  },
  tenantName: {
    fontSize: f.lg,
    fontWeight: "700",
    color: colors.foreground,
  },
  tenantMeta: {
    fontSize: f.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  changeTenantButton: {
    marginTop: s.md,
  },
  changeTenantText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: f.sm,
  },
  form: {
    flex: 1,
  },
  formTitle: {
    fontSize: f["2xl"],
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: s.xs,
  },
  formSubtitle: {
    fontSize: f.base,
    color: colors.mutedForeground,
    marginBottom: s.lg,
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: r.md,
    paddingHorizontal: s.md,
    fontSize: f.md,
    backgroundColor: colors.card,
    marginBottom: s.md,
    color: colors.foreground,
  },
  passwordContainer: {
    position: "relative",
    marginBottom: s.md,
  },
  passwordInput: {
    paddingRight: 72,
  },
  eyeButton: {
    position: "absolute",
    right: s.md,
    top: s.md + 2,
    padding: s.sm,
  },
  eyeText: {
    fontSize: f.sm,
    color: colors.primary,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: colors.destructiveMuted,
    borderRadius: r.sm,
    padding: s.md,
    marginBottom: s.md,
    borderWidth: 1,
    borderColor: colors.destructiveMuted,
  },
  errorText: {
    color: colors.destructive,
    fontSize: f.base,
  },
  button: {
    height: 56,
    borderRadius: r.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: s.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontSize: f.md,
    fontWeight: "600",
  },
  toggle: {
    marginTop: s.lg,
    alignItems: "center",
  },
  toggleText: {
    fontSize: f.base,
    color: colors.mutedForeground,
  },
  toggleLink: {
    color: colors.primary,
    fontWeight: "600",
  },
});
