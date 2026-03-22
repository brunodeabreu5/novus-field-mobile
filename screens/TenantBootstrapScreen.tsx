import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useTenant } from "../contexts/TenantContext";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";

export default function TenantBootstrapScreen() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { resolveTenant } = useTenant();

  const handleContinue = async () => {
    const value = identifier.trim();
    if (!value) {
      setError("Informe seu código.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await resolveTenant(value);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel localizar a empresa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Image
              source={require("../assets/icon.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brand}>NovusField</Text>
        </View>
        <Text style={styles.title}>Conecte a sua empresa</Text>
        <Text style={styles.subtitle}>Informe seu código.</Text>

        <TextInput
          style={styles.input}
          placeholder="Digite seu código"
          placeholderTextColor={colors.mutedForeground}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.buttonText}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = spacing;
const f = fontSize;
const r = radius;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: s.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: r.lg,
    padding: s.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    alignItems: "center",
    marginBottom: s.lg,
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
  brand: {
    fontSize: f["3xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  title: {
    fontSize: f["2xl"],
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: s.sm,
  },
  subtitle: {
    fontSize: f.base,
    color: colors.mutedForeground,
    lineHeight: 22,
    marginBottom: s.lg,
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: r.md,
    paddingHorizontal: s.md,
    fontSize: f.md,
    backgroundColor: colors.background,
    color: colors.foreground,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: r.sm,
    padding: s.md,
    marginTop: s.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
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
    marginTop: s.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontSize: f.md,
    fontWeight: "600",
  },
});
