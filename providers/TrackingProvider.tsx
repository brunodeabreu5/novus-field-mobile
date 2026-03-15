import React from "react";
import { useTrackingBootstrap } from "../hooks/use-tracking-bootstrap";

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  useTrackingBootstrap();
  return <>{children}</>;
}
