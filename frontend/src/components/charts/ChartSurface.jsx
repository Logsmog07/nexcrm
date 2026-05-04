import { useEffect, useRef, useState } from "react";

export function ChartSurface({ className = "", children }) {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const isReady = size.width > 0 && size.height > 0;

  const content =
    typeof children === "function"
      ? children(size)
      : children;

  return (
    <div ref={hostRef} className={className}>
      {isReady ? content : (
        <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
          Preparing chart...
        </div>
      )}
    </div>
  );
}