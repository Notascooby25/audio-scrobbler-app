import React from "react";
import { useSkin } from "./useSkin";

/**
 * Slot Component
 * Renders the active skin's implementation of a named slot, or falls back to
 * default markup or Classic component.
 */
export default function Slot({ name, fallback = null, children = null, ...props }) {
  const { skin } = useSkin();
  const SlotComponent = skin?.slots?.[name];

  if (SlotComponent) {
    return <SlotComponent {...props}>{children}</SlotComponent>;
  }

  if (fallback) {
    return typeof fallback === "function" ? React.createElement(fallback, props) : fallback;
  }

  return children;
}
