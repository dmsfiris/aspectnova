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
 
import i18n from "@/lib/i18n";

export function setLanguage(lang: string): Promise<void> {
  if (!["en", "el"].includes(lang)) {
    // eslint-disable-next-line no-console
    console.warn(`Unsupported language "${lang}", falling back to en`);
    lang = "en";
  }
  return i18n.changeLanguage(lang);
}

export function getLanguage(): string {
  return i18n.language || "en";
}

/**
 * Safe wrapper around i18n.t
 * @param key Translation key
 * @param options Optional interpolation/formatting values
 */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options ?? {});
}
