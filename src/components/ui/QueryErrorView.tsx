// src/components/ui/QueryErrorView.tsx
import React from "react";

import { ErrorView } from "@/components/ui/ErrorView";
import { mapApiError } from "@/lib/errors";

type Props = {
  error: unknown;
  onRetry: () => void;
  loading?: boolean;
  testID?: string;
};

export function QueryErrorView({ error, onRetry, loading, testID }: Props) {
  const { title, message } = mapApiError(error);
  return (
    <ErrorView
      title={title}
      message={message}
      onRetry={onRetry}
      loading={loading}
      testID={testID}
    />
  );
}
