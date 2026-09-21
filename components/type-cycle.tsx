"use client";

import {useEffect, useState} from "react";
import {Type} from "lucide-react";

const FACES = [
  {
    name: "Bebas Neue",
    sample: "TURN IT UP",
    className: "face-bebas",
  },
  {
    name: "Playfair Display",
    sample: "Softly, for the room",
    className: "face-playfair",
  },
  {
    name: "Space Mono",
    sample: "SYNC_TO_BEAT",
    className: "face-mono",
  },
] as const;

const INTERVAL_MS = 3200;

export function TypeCycle() {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % FACES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  const face = FACES[index];

  return (
    <div className="type-cycle" aria-live="polite">
      <div className="type-cycle-stage" key={face.name}>
        <div className={`type-stage ${face.className}`}>
          <span>{face.sample}</span>
          <i aria-hidden="true" />
        </div>
        <footer>
          <Type aria-hidden="true" />
          <b>{face.name}</b>
          <span className="type-cycle-dots" aria-hidden="true">
            {FACES.map((f, i) => (
              <i key={f.name} className={i === index ? "active" : undefined} />
            ))}
          </span>
        </footer>
      </div>
      {!reduced && (
        <div className="type-cycle-sr" aria-hidden="true">
          {FACES.map((f) => (
            <span key={f.name}>{f.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
