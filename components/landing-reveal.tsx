"use client";

import {useEffect, useRef, type CSSProperties, type ReactNode} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "article" | "header";
};

export function LandingReveal({children, className = "", delay = 0, as: Tag = "div"}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      {threshold: 0.14, rootMargin: "0px 0px -6% 0px"},
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = (delay ? {["--reveal-delay" as string]: `${delay}ms`} : undefined) as CSSProperties | undefined;

  return (
    <Tag ref={ref as never} className={`landing-reveal ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}
