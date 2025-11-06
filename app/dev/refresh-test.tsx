// app/dev/refresh-test.tsx
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";

import { env } from "@/config/env";
import { mapApiError } from "@/lib/errors";
import { devLog } from "@/utils/devLog";
import { loginWithPassword, getJSON, clearSession } from "@api";

/** Avoid `unknown` in a union (it dominates). Use a catch-all record instead. */
type ProtectedResponse = { ok: true; userId?: string } | Record<string, unknown>;

export default function RefreshTest(): JSX.Element {
  const [email, setEmail] = useState<string>("test@example.com");
  const [password, setPassword] = useState<string>("password");
  const [busy, setBusy] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  // For delayed call + cancellation
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      abortRef.current?.abort();
    };
  }, []);

  const log = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${stamp}] ${line}`, ...prev].slice(0, 200));
    devLog(line);
  }, []);

  const logData = useCallback(
    (label: string, data: unknown) => {
      try {
        const str = JSON.stringify(
          data,
          (_k: string, v: unknown): unknown => v, // ← typed replacer removes no-unsafe-return
          2
        );
        const compact = str.length > 500 ? `${str.slice(0, 497)}…` : str;
        log(`${label}: ${compact}`);
      } catch {
        log(`${label}: [unserializable]`);
      }
    },
    [log]
  );

  const doLogin = useCallback(async (): Promise<void> => {
    try {
      setBusy(true);
      log(`POST /auth/login → ${env.API_BASE_URL}/auth/login`);
      const res = await loginWithPassword({ email, password });
      // Access token expected as string from API module
      log(`Login OK. Access token len=${String(res.accessToken ?? "").length}`);
    } catch (e: unknown) {
      const { title, message } = mapApiError(e);
      log(`Login FAILED: ${title}${message ? ` — ${message}` : ""}`);
    } finally {
      setBusy(false);
    }
  }, [email, password, log]);

  const callProtectedNow = useCallback(async (): Promise<void> => {
    try {
      setBusy(true);
      log("GET /protected (immediate)");
      const controller = new AbortController();
      abortRef.current = controller;
      const data = await getJSON<ProtectedResponse>("/protected", {
        signal: controller.signal
      });
      logData("Protected OK", data);
    } catch (e: unknown) {
      const { title, message } = mapApiError(e);
      log(`Protected FAILED: ${title}${message ? ` — ${message}` : ""}`);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [log, logData]);

  const callProtectedAfter = useCallback(
    (ms: number): void => {
      if (timer.current) clearTimeout(timer.current);
      abortRef.current?.abort();
      log(`Waiting ${Math.round(ms / 1000)}s so access token can expire...`);

      timer.current = setTimeout(() => {
        (async () => {
          try {
            setBusy(true);
            log("GET /protected (after wait) — should auto-refresh on 401");
            const controller = new AbortController();
            abortRef.current = controller;
            const data = await getJSON<ProtectedResponse>("/protected", {
              signal: controller.signal
            });
            logData("Protected OK after refresh", data);
          } catch (e: unknown) {
            const { title, message } = mapApiError(e);
            log(`Protected FAILED after wait: ${title}${message ? ` — ${message}` : ""}`);
          } finally {
            setBusy(false);
            abortRef.current = null;
          }
        })().catch(() => {
          /* swallow to avoid unhandled rejection */
        });
      }, ms);
    },
    [log, logData]
  );

  const doLogout = useCallback(async (): Promise<void> => {
    try {
      setBusy(true);
      abortRef.current?.abort();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      await clearSession();
      log(
        "Session cleared (access token removed, refresh cookie invalidated if server supports /auth/logout)."
      );
    } finally {
      setBusy(false);
    }
  }, [log]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Refresh Flow Test" }} />

      <View style={styles.body}>
        <Text style={styles.api} selectable>
          API: {env.API_BASE_URL}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            style={styles.input}
          />
        </View>

        <View style={styles.row}>
          <Btn label="Login" onPress={doLogin} busy={busy} />
          <Btn label="Protected now" onPress={callProtectedNow} busy={busy} />
          <Btn
            label="Protected after 20s"
            onPress={() => callProtectedAfter(20000)}
            busy={busy}
          />
          <Btn label="Logout" onPress={doLogout} busy={busy} kind="warn" />
          <Btn label="Clear logs" onPress={() => setLogs([])} kind="ghost" busy={busy} />
        </View>

        <Text style={styles.logsLabel}>Logs</Text>

        <ScrollView
          style={styles.logs}
          contentContainerStyle={styles.logsContent}
          accessibilityRole="log"
        >
          {busy ? <ActivityIndicator style={{ marginBottom: 8 }} /> : null}
          {logs.map((l, i) => (
            <Text key={i} style={styles.logLine}>
              {l}
            </Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function Btn({
  label,
  onPress,
  busy,
  kind = "primary"
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  kind?: "primary" | "warn" | "ghost";
}) {
  const s =
    kind === "warn"
      ? { bg: "#7c2d12", fg: "#fff", border: "#7c2d12" }
      : kind === "ghost"
        ? { bg: "transparent", fg: "#e5e7eb", border: "#334155" }
        : { bg: "#1d4ed8", fg: "#fff", border: "#1d4ed8" };

  return (
    <Pressable
      onPress={onPress}
      disabled={!!busy}
      style={[
        styles.btn,
        { backgroundColor: s.bg, borderColor: s.border, opacity: busy ? 0.8 : 1 }
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.btnText, { color: s.fg }]}>{label}</Text>
    </Pressable>
  );
}

const webGap = (n: number): ViewStyle =>
  Platform.OS === "web" ? ({ gap: n } as unknown as ViewStyle) : {};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  body: { padding: 16, ...webGap(12) },
  api: { color: "#cbd5e1", fontSize: 12 },
  field: { ...webGap(8) },
  label: { color: "#e2e8f0" },
  input: {
    backgroundColor: "#111827",
    color: "#e5e7eb",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151"
  },
  row: { flexDirection: "row", flexWrap: "wrap", ...webGap(8) },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  btnText: { fontWeight: "600" },
  logsLabel: { color: "#9ca3af", marginTop: 8, marginBottom: 4 },
  logs: {
    flex: 1,
    backgroundColor: "#0b1020",
    borderTopWidth: 1,
    borderTopColor: "#1f2937"
  },
  logsContent: { padding: 12, ...webGap(6) },
  logLine: { color: "#94a3b8", fontSize: 12 }
});
