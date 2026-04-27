import type { ReactNode } from "react";

const waveLayers = [
  { className: "auth-wave-beach", src: "/auth-waves/beach.png" },
  { className: "auth-wave-water-deep", src: "/auth-waves/water-deep.png" },
  { className: "auth-wave-water-light", src: "/auth-waves/water-light.png" },
  { className: "auth-wave-foam", src: "/auth-waves/foam-white.png" },
  { className: "auth-wave-particles", src: "/auth-waves/particles.png" }
];

export function AuthOceanVisual({
  eyebrow,
  title,
  description,
  meta,
  metaLabel = "队列优先"
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  meta: string;
  metaLabel?: string;
}) {
  return (
    <section className="auth-visual card">
      <div className="auth-visual-copy">
        <p className="auth-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="auth-visual-meta">
        <span>{metaLabel}</span>
        <strong>{meta}</strong>
      </div>

      <div className="ocean-stage" aria-hidden="true">
        <div className="auth-wave-frame">
          {waveLayers.map((layer) => (
            <img
              key={layer.src}
              alt=""
              className={`auth-wave-layer ${layer.className}`}
              decoding="async"
              draggable={false}
              src={layer.src}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
