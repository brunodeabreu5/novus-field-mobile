import React, { createContext, useContext } from "react";
import { useTrackingBootstrap } from "../hooks/use-tracking-bootstrap";

export type TrackingState =
  | "background"
  | "foreground_only"
  | "denied"
  | "error"
  | null;

interface TrackingContextValue {
  trackingState: TrackingState;
  trackingError: string | null;
}

const TrackingContext = createContext<TrackingContextValue | undefined>(undefined);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const value = useTrackingBootstrap();

  return (
    <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
  );
}

export function useTrackingStatus() {
  const context = useContext(TrackingContext);

  if (!context) {
    throw new Error("useTrackingStatus must be used within TrackingProvider");
  }

  return context;
}
