"use client";

import { Component, type ReactNode } from "react";

/** A map failure (tiles, Leaflet, WebGL quirks) must never take the list down with it. */
export class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
          The map couldn&apos;t load. Every place is still in the list, and comparing still works.
        </div>
      );
    }
    return this.props.children;
  }
}
