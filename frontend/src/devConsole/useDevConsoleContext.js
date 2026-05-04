import { useContext } from "react";
import { DevConsoleContext } from "./DevConsoleContext";

export function useDevConsoleContext() {
  const context = useContext(DevConsoleContext);
  if (!context) {
    throw new Error("useDevConsoleContext must be used within DevConsoleProvider");
  }

  return context;
}
