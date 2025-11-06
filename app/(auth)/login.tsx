// app/(auth)/login.tsx
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import Button from "@/components/ui/Button";
import FormInput from "@/components/ui/FormInput";
import { colors, font, radius, shadow, spacing } from "@/config/constants";
import { AFTER_LOGIN_PATH } from "@/config/routes";
import { mapApiError } from "@/lib/errors";
import { useAuth } from "@/store/useAuth";

export default function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const { t } = useTranslation();

  const login = useAuth(s => s.login);

  const tStr = useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return typeof v === "string" && v.length > 0 ? v : fallback;
    },
    [t]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => !loading && email.trim().length > 0 && password.trim().length > 0,
    [loading, email, password]
  );

  const handleLogin = useCallback(async (): Promise<void> => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password.trim());
      router.replace(AFTER_LOGIN_PATH);
    } catch (e: unknown) {
      const mapped = mapApiError(e);
      setError(
        mapped.message || mapped.title || tStr("auth.loginFailed", "Sign in failed")
      );
    } finally {
      setLoading(false);
    }
  }, [canSubmit, email, password, login, router, tStr]);

  const buttonStyle: StyleProp<ViewStyle> = !canSubmit ? { opacity: 0.6 } : undefined;

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.centered}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.card} accessibilityState={{ busy: loading }}>
          <Text style={[font.title, styles.title]}>{tStr("auth.signIn", "Sign in")}</Text>
          <Text style={[font.small, styles.subtitle]}>
            {tStr("auth.welcomeBack", "Welcome back. Please sign in to continue.")}
          </Text>

          <View style={styles.form}>
            <FormInput
              label={tStr("auth.email", "Email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              accessibilityLabel={tStr("auth.email", "Email")}
            />

            <FormInput
              label={tStr("auth.password", "Password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              // Avoid `no-void`: call and swallow rejections explicitly
              onSubmitEditing={() => {
                handleLogin().catch(() => {});
              }}
              accessibilityLabel={tStr("auth.password", "Password")}
            />

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <Button
              onPress={() => {
                handleLogin().catch(() => {});
              }}
              disabled={!canSubmit}
              accessibilityLabel={tStr("auth.signIn", "Sign in")}
              style={buttonStyle}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text>{tStr("auth.signIn", "Sign in")}</Text>
              )}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card
  },
  title: { color: colors.text, textAlign: "center" },
  subtitle: {
    color: colors.mutedText,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg
  },
  form: { gap: spacing.md },
  error: {
    color: colors.danger,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    textAlign: "center"
  }
});
