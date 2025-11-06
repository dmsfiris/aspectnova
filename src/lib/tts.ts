/**
 * Copyright (c) 2025 AspectSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
import * as Speech from "expo-speech";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

export type SpeakOptions = {
  pitch?: number;
  rate?: number;
  language?: string;
  /** Auto-cancel if not finished within this time (web only). */
  maxDurationMs?: number; // e.g., 60_000
};

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

export function useTts() {
  const [speaking, setSpeaking] = useState(false);
  const lastUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const webTimeoutRef = useRef<number | null>(null);

  const clearWebTimer = () => {
    if (webTimeoutRef.current != null && hasWindow()) {
      window.clearTimeout(webTimeoutRef.current);
      webTimeoutRef.current = null;
    }
  };

  const stop = useCallback(() => {
    if (Platform.OS === "web" && hasWindow() && "speechSynthesis" in window) {
      clearWebTimer();
      window.speechSynthesis.cancel();
      lastUtteranceRef.current = null;
    } else {
      // Works for both sync and async implementations without `void`
      Promise.resolve(Speech.stop()).catch(() => {
        /* ignore */
      });
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, opts: SpeakOptions = {}): Promise<void> => {
      if (!text) return;

      // WEB
      if (Platform.OS === "web" && hasWindow() && "speechSynthesis" in window) {
        clearWebTimer();
        window.speechSynthesis.cancel();

        const maxDuration =
          typeof opts.maxDurationMs === "number" ? opts.maxDurationMs : 60_000;

        await new Promise<void>(resolve => {
          const u = new SpeechSynthesisUtterance(text);
          lastUtteranceRef.current = u;

          if (opts.language) u.lang = opts.language;
          if (typeof opts.pitch === "number")
            u.pitch = Math.max(0, Math.min(2, opts.pitch));
          if (typeof opts.rate === "number")
            u.rate = Math.max(0.1, Math.min(10, opts.rate));

          const finish = () => {
            clearWebTimer();
            setSpeaking(false);
            lastUtteranceRef.current = null;
            resolve();
          };

          u.onstart = () => {
            setSpeaking(true);
            if (maxDuration > 0) {
              webTimeoutRef.current = window.setTimeout(() => {
                try {
                  window.speechSynthesis.cancel();
                } finally {
                  finish();
                }
              }, maxDuration);
            }
          };
          u.onend = finish;
          u.onerror = finish;

          window.speechSynthesis.speak(u);
        });

        return;
      }

      // NATIVE
      await new Promise<void>(resolve => {
        Speech.speak(text, {
          pitch: opts.pitch,
          rate: opts.rate,
          language: opts.language,
          onStart: () => setSpeaking(true),
          onDone: () => {
            setSpeaking(false);
            resolve();
          },
          onStopped: () => {
            setSpeaking(false);
            resolve();
          },
          onError: () => {
            setSpeaking(false);
            resolve();
          }
        });
      });
    },
    []
  );

  const speakPageText = useCallback(
    async (_docId: string, page: number, opts?: SpeakOptions): Promise<void> => {
      await speak(`Reading page ${page}.`, opts);
    },
    [speak]
  );

  return { speaking, speak, stop, speakPageText };
}
