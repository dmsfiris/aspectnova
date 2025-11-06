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
 
import { APIError } from "@/api/client";

/* --------------------------- tiny safe accessors --------------------------- */

function isObject(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null;
}

function getStringProp(obj: unknown, key: string): string | undefined {
  if (!isObject(obj)) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNumberProp(obj: unknown, key: string): number | undefined {
  if (!isObject(obj)) return undefined;
  const v = obj[key];
  return typeof v === "number" ? v : undefined;
}

/** Detect an abort from fetch/React Query */
export function isAbortError(e: unknown): boolean {
  return getStringProp(e, "name") === "AbortError";
}

/** Detect network-layer failures (no HTTP response) */
export function isNetworkError(e: unknown): boolean {
  // RN/Web fetch typically throws TypeError on network failure.
  // Some runtimes may surface status: 0 for network failures.
  return e instanceof TypeError || getNumberProp(e, "status") === 0;
}

/** Detect generic HTTP-like error objects (e.g., libraries throwing { status, statusText }) */
function isHttpLikeError(e: unknown): e is { status: number; statusText?: string } {
  const status = getNumberProp(e, "status");
  return typeof status === "number";
}

export type MappedError = {
  title: string;
  message?: string;
  actionLabel?: string;
};

/** Map any error to a friendly, consistent UI message */
export function mapApiError(e: unknown): MappedError {
  if (isAbortError(e)) {
    return { title: "Cancelled" };
  }

  if (e instanceof APIError) {
    const status = e.status;

    if (status === 401)
      return { title: "Session expired", message: "Please sign in again." };
    if (status === 403)
      return { title: "Not allowed", message: "You don’t have permission." };
    if (status === 404)
      return { title: "Not found", message: "The item may have been removed." };
    if (status === 413)
      return { title: "Too large", message: "The request payload is too big." };
    if (status === 429)
      return { title: "Too many requests", message: "Please try again shortly." };
    if (status >= 500)
      return { title: "Server error", message: "Please try again in a moment." };

    let apiMsg: string | undefined;
    if (typeof e.data === "string") {
      apiMsg = e.data;
    } else if (isObject(e.data)) {
      apiMsg = getStringProp(e.data, "message") ?? getStringProp(e.data, "error");
    }

    return { title: "Request failed", message: apiMsg || "Please try again." };
  }

  if (isNetworkError(e)) {
    return { title: "Network error", message: "Check your connection and try again." };
  }

  // Fallback for libraries that throw plain HTTP-like objects (not our APIError)
  if (isHttpLikeError(e)) {
    const status = getNumberProp(e, "status")!;
    const statusText = getStringProp(e, "statusText") ?? "";

    // Reuse friendly titles for common codes; otherwise show a generic HTTP label.
    if (status === 401)
      return { title: "Session expired", message: "Please sign in again." };
    if (status === 403)
      return { title: "Not allowed", message: "You don’t have permission." };
    if (status === 404)
      return { title: "Not found", message: "The item may have been removed." };
    if (status === 413)
      return { title: "Too large", message: "The request payload is too big." };
    if (status === 429)
      return { title: "Too many requests", message: "Please try again shortly." };
    if (status >= 500)
      return { title: "Server error", message: "Please try again in a moment." };

    return {
      title: `HTTP ${status}`,
      message: statusText || "Request failed."
    };
  }

  const msg = getStringProp(e, "message");
  return { title: "Something went wrong", message: msg };
}
