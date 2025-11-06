/* eslint-disable no-console */
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
 
import { env } from "../config/env";

/**
 * Dev-only logger. Emits to console when:
 * - API_DEBUG=1 (via .env / app.config.ts), or
 * - __DEV__ is true (Expo dev mode)
 *
 * Usage:
 *   devLog("some message", data)
 */
export function devLog(...args: unknown[]): void {
  // Normalize API_DEBUG to a string for comparison
  const debugFlag =
    typeof env.API_DEBUG === "number" ? env.API_DEBUG.toString() : env.API_DEBUG;

  const enabled =
    debugFlag === "1" ||
    debugFlag === "true" ||
    (typeof __DEV__ !== "undefined" && __DEV__);

  if (enabled) {
    console.log("[dev]", ...args);
  }
}
