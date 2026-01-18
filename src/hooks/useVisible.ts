import { useEffect, useRef, useState } from "react";

export function useVisible<T extends HTMLElement>(
  options?: IntersectionObserverInit
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px",
        threshold: 0.01,
        ...options,
      }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [visible, options]);

  return { ref, visible };
}
