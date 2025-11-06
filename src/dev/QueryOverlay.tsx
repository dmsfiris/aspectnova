// src/dev/QueryOverlay.tsx
import { useQueryClient, type Query } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
  type GestureResponderEvent
} from "react-native";

type Pos = { x: number; y: number };

function formatAgo(ms: number): string {
  if (!ms) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function statusColor(status: Query["state"]["status"]): string {
  switch (status) {
    case "pending":
      return "#f59e0b";
    case "error":
      return "#ef4444";
    case "success":
      return "#10b981";
    default:
      return "#93c5fd";
  }
}

function fetchColor(fetchStatus: Query["state"]["fetchStatus"]): string {
  switch (fetchStatus) {
    case "fetching":
      return "#fde047";
    case "paused":
      return "#a78bfa";
    case "idle":
    default:
      return "#9ca3af";
  }
}

function prettyKey(q: Query): string {
  try {
    const raw = q.queryKey ?? [];
    return JSON.stringify(raw);
  } catch {
    return String(q.queryHash ?? "unknown");
  }
}

function tinyPreview(data: unknown): string {
  if (data == null) return "—";
  try {
    if (typeof data === "string")
      return data.length > 60 ? `${data.slice(0, 57)}…` : data;
    if (Array.isArray(data)) return `Array(${data.length})`;
    if (typeof data === "object") {
      const keys = Object.keys(data as Record<string, unknown>);
      return `Object{${keys.slice(0, 4).join(", ")}${keys.length > 4 ? ", …" : ""}}`;
    }
    if (
      typeof data === "number" ||
      typeof data === "boolean" ||
      typeof data === "bigint"
    ) {
      return String(data);
    }
    if (typeof data === "symbol") return data.toString();
    if (typeof data === "function") {
      const fn = data as (...args: unknown[]) => unknown;
      const name = (fn as { name?: string }).name || "anonymous";
      return `[fn ${name}]`;
    }
    return "[unserializable]";
  } catch {
    return "[unserializable]";
  }
}

function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function hasOptionsWithStaleTime(x: unknown): x is { options: { staleTime?: unknown } } {
  return (
    !!x &&
    typeof x === "object" &&
    "options" in (x as Record<string, unknown>) &&
    typeof (x as { options?: unknown }).options === "object"
  );
}

function getStaleTime(q: Query): number | undefined {
  if (hasOptionsWithStaleTime(q)) {
    const st = q.options.staleTime;
    if (typeof st === "number") return st;
  }
  return undefined;
}

function useWebKeyToggle(
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
): void {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase?.();
      if (key === "q") setVisible(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setVisible]);
}

function Draggable({
  children,
  startPos = { x: 12, y: 60 }
}: {
  children: (pos: Pos) => React.ReactNode;
  startPos?: Pos;
}) {
  const [pos, setPos] = useState<Pos>(startPos);
  const draggingRef = useRef(false);
  const startRef = useRef<{
    touchX: number;
    touchY: number;
    x: number;
    y: number;
  } | null>(null);

  const onStart = (e: GestureResponderEvent): void => {
    const touch = e.nativeEvent;
    draggingRef.current = true;
    startRef.current = { touchX: touch.pageX, touchY: touch.pageY, x: pos.x, y: pos.y };
  };

  const onMove = (e: GestureResponderEvent): void => {
    if (!draggingRef.current || !startRef.current) return;
    const touch = e.nativeEvent;
    setPos({
      x: Math.max(8, startRef.current.x + (touch.pageX - startRef.current.touchX)),
      y: Math.max(8, startRef.current.y + (touch.pageY - startRef.current.touchY))
    });
  };

  const onEnd = (): void => {
    draggingRef.current = false;
    startRef.current = null;
  };

  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderGrant={onStart}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
      style={[
        styles.floating,
        {
          position: Platform.OS === "web" ? "fixed" : "absolute",
          bottom: pos.y,
          right: pos.x
        }
      ]}
    >
      {children(pos)}
    </View>
  );
}

function usePanelWidth(): number {
  const [w, setW] = useState(() => Dimensions.get("window").width);
  useEffect(() => {
    const handler = ({ window }: { window: { width: number } }) => setW(window.width);
    const sub = Dimensions.addEventListener("change", handler);

    return () => {
      // Preferred modern API
      if (sub && typeof (sub as { remove?: () => void }).remove === "function") {
        (sub as { remove: () => void }).remove();
        return;
      }
      // Legacy API (narrow the method BEFORE calling)
      const maybeRemove = (
        Dimensions as unknown as {
          removeEventListener?: (
            type: "change",
            h: (e: { window: { width: number } }) => void
          ) => void;
        }
      ).removeEventListener;
      if (typeof maybeRemove === "function") {
        maybeRemove("change", handler);
      }
    };
  }, []);
  if (Platform.OS === "web") {
    const computed = Math.min(520, Math.floor(w * 0.9));
    return Math.max(280, computed);
  }
  return 340;
}

function useNowTick(visible: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, visible]);
  return now;
}

function sameQueries(a: Query[], b: Query[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((qa, i) => qa.queryHash === b[i].queryHash);
}

export default function QueryOverlay({ initialOpen = false }: { initialOpen?: boolean }) {
  const qc = useQueryClient();
  const [visible, setVisible] = useState(initialOpen);
  const [queries, setQueries] = useState<Query[]>([]);
  const panelWidth = usePanelWidth();
  const now = useNowTick(visible, 1000);

  useEffect(() => {
    if (!visible) return;
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const throttle = (fn: () => void): void => {
      if (Platform.OS === "web") {
        if (rafId != null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          fn();
        });
      } else {
        if (timeoutId != null) return;
        timeoutId = setTimeout(() => {
          timeoutId = null;
          fn();
        }, 16);
      }
    };

    const push = (): void => {
      const all = qc.getQueryCache().getAll();
      const sorted = [...all].sort((a, b) => (a.queryHash < b.queryHash ? -1 : 1));
      setQueries(prev => (sameQueries(prev, sorted) ? prev : sorted));
    };

    push();

    const cache = qc.getQueryCache();
    type Unsub = ReturnType<typeof cache.subscribe>;
    const maybeUnsub: Unsub = cache.subscribe(() => {
      throttle(push);
    });

    return () => {
      if (typeof maybeUnsub === "function") {
        maybeUnsub();
      }
      if (rafId != null) cancelAnimationFrame(rafId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [qc, visible]);

  useWebKeyToggle(setVisible);

  const sorted = queries;
  const chipSpacing: { marginRight: number; marginBottom: number } = {
    marginRight: 12,
    marginBottom: 4
  };

  return (
    <>
      <Draggable startPos={{ x: 12, y: 60 }}>
        {() => (
          <Pressable
            onPress={() => setVisible(v => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle Query Overlay"
            style={[
              styles.badge,
              {
                backgroundColor: visible ? "#1d4ed8" : "#111827",
                borderColor: visible ? "#1d4ed8" : "#374151"
              }
            ]}
          >
            <Text style={styles.badgeText}>RQ</Text>
          </Pressable>
        )}
      </Draggable>

      {!visible ? null : (
        <View
          style={[
            styles.panel,
            {
              width: panelWidth,
              position: Platform.OS === "web" ? "fixed" : "absolute",
              bottom: 140,
              right: 12
            }
          ]}
        >
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>React Query ({sorted.length})</Text>
            <Pressable
              onPress={() => setVisible(false)}
              accessibilityLabel="Close overlay"
            >
              <Text style={styles.panelClose}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: "100%" }}
            contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8 }}
          >
            {sorted.map(q => {
              const st = q.state;
              const ageMs = st.dataUpdatedAt ? now - st.dataUpdatedAt : 0;
              const staleFor = getStaleTime(q);

              return (
                <View key={q.queryHash} style={styles.card}>
                  <Text style={styles.cardKey}>{prettyKey(q)}</Text>
                  <View style={styles.row}>
                    <Text style={[{ color: statusColor(st.status) }, chipSpacing]}>
                      status: {st.status}
                    </Text>
                    <Text style={[{ color: fetchColor(st.fetchStatus) }, chipSpacing]}>
                      fetch: {st.fetchStatus}
                    </Text>
                    <Text style={[{ color: "#93c5fd" }, chipSpacing]}>
                      fresh: {formatAgo(ageMs)} ago
                    </Text>
                    {typeof staleFor === "number" && (
                      <Text style={[{ color: "#a7f3d0" }, chipSpacing]}>
                        staleTime: {Math.round(staleFor / 1000)}s
                      </Text>
                    )}
                    <Text
                      style={[
                        { color: st.isInvalidated ? "#f59e0b" : "#9ca3af" },
                        chipSpacing
                      ]}
                    >
                      invalidated: {String(st.isInvalidated)}
                    </Text>
                    <Text
                      style={[
                        { color: st.dataUpdatedAt ? "#9ca3af" : "#ef4444" },
                        chipSpacing
                      ]}
                    >
                      hasData: {String(!!st.dataUpdatedAt)}
                    </Text>
                    <Text style={[{ color: "#9ca3af" }, chipSpacing]}>
                      obs: {q.getObserversCount()}
                    </Text>
                  </View>

                  <View style={{ marginTop: 6 }}>
                    {st.error ? (
                      <Text style={{ color: "#fca5a5" }}>
                        error: {errorMessage(st.error)}
                      </Text>
                    ) : (
                      <Text style={{ color: "#cbd5e1" }}>
                        data: {tinyPreview(st.data)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            {sorted.length === 0 && (
              <Text style={{ color: "#9ca3af", padding: 8 }}>No queries yet.</Text>
            )}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  floating: { zIndex: 99999 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  badgeText: { color: "white", fontWeight: "700" },
  panel: {
    maxHeight: "50%",
    backgroundColor: "rgba(3,7,18,0.95)",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 99998
  },
  panelHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  panelTitle: { color: "#e5e7eb", fontWeight: "700" },
  panelClose: { color: "#9ca3af" },
  card: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#0b1220"
  },
  cardKey: { color: "#e5e7eb", fontWeight: "600" },
  row: {
    flexDirection: "row",
    marginTop: 6,
    flexWrap: "wrap"
  }
});
