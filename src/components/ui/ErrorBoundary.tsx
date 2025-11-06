// src/components/ui/ErrorBoundary.tsx
import React from "react";

import { ErrorView } from "@/components/ui/ErrorView";
import { mapApiError } from "@/lib/errors";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

// `unknown` already covers `null`, so remove redundancy
type State = { error: unknown };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override render() {
    if (this.state.error) {
      const mapped = mapApiError(this.state.error);
      return (
        <ErrorView
          title={this.props.fallbackTitle ?? mapped.title}
          message={mapped.message}
        />
      );
    }
    return this.props.children;
  }
}
