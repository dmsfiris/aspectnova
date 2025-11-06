// src/components/ui/SafeImage.tsx
import { Image as ExpoImage, type ImageProps } from "expo-image";
import React from "react";

import { getSafeImageUrl, PLACEHOLDER_BLURHASH } from "@/lib/image-utils";

/** Narrow to objects that look like { uri: string } */
function hasUri(x: unknown): x is { uri: string } {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { uri?: unknown }).uri === "string"
  );
}

/**
 * SafeImage
 * - Normalizes all image URIs through getSafeImageUrl (resolves mock/asset/CDN forms)
 * - Adds a lightweight blurhash placeholder if available
 * - No headers: expects public or short-lived signed URLs from backend
 */
export function SafeImage(props: ImageProps): React.ReactElement {
  const { source, ...rest } = props;

  const safeSource = React.useMemo<ImageProps["source"]>(() => {
    if (Array.isArray(source)) {
      return source.map(s => {
        if (!hasUri(s)) return s;
        const safe = getSafeImageUrl(s.uri);
        return typeof safe === "string" ? { uri: safe } : s;
      });
    }

    if (hasUri(source)) {
      const safe = getSafeImageUrl(source.uri);
      return typeof safe === "string" ? { uri: safe } : source;
    }

    return source;
  }, [source]);

  const placeholder =
    PLACEHOLDER_BLURHASH.length === 28 ? { blurhash: PLACEHOLDER_BLURHASH } : undefined;

  return <ExpoImage {...rest} source={safeSource} placeholder={placeholder} />;
}
