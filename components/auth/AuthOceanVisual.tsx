import type { ReactNode } from "react";

export function AuthOceanVisual({
  eyebrow,
  title,
  description,
  meta
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  meta: string;
}) {
  return (
    <section className="auth-visual card">
      <div className="auth-visual-copy">
        <p className="auth-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="auth-visual-meta">
        <span>Queue first</span>
        <strong>{meta}</strong>
      </div>

      <div className="ocean-stage" aria-hidden="true">
        <svg viewBox="0 0 760 520" className="ocean-svg">
          <defs>
            <linearGradient id="oceanGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#27d5ff" />
              <stop offset="48%" stopColor="#1177d8" />
              <stop offset="100%" stopColor="#073873" />
            </linearGradient>
            <linearGradient id="boatGradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#f5c079" />
              <stop offset="100%" stopColor="#8d4f24" />
            </linearGradient>
            <filter id="softGlow">
              <feDropShadow dx="0" dy="14" floodColor="#002b5c" floodOpacity="0.25" stdDeviation="16" />
            </filter>
          </defs>

          <g className="ocean-current ocean-current-a">
            <path d="M-34 286C75 207 171 217 282 256C387 293 472 301 591 206C678 136 738 134 807 151V560H-34Z" fill="url(#oceanGradient)" opacity="0.9" />
            <path d="M18 211C99 182 156 197 246 226C368 266 462 248 552 166C610 113 682 94 746 104" fill="none" stroke="#fbfbf4" strokeLinecap="round" strokeWidth="18" opacity="0.9" />
          </g>

          <g className="ocean-current ocean-current-b">
            <path d="M-15 382C109 332 205 346 315 383C423 420 526 433 769 275V560H-15Z" fill="#10a9e9" opacity="0.52" />
            <path d="M46 364C134 324 236 329 328 358C440 394 548 387 677 313" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="12" opacity="0.55" />
          </g>

          <g className="whale whale-large" filter="url(#softGlow)">
            <path d="M80 309C156 243 282 222 387 262C457 289 505 286 564 247C546 307 476 357 372 366C247 377 141 359 80 309Z" fill="#063a74" opacity="0.62" />
            <path d="M556 249C610 228 648 223 690 238C651 252 623 272 606 311C597 283 581 263 556 249Z" fill="#063a74" opacity="0.62" />
            <ellipse cx="276" cy="323" fill="#052b56" opacity="0.42" rx="74" ry="23" transform="rotate(6 276 323)" />
          </g>

          <g className="whale whale-small whale-small-a">
            <path d="M138 425C189 392 257 387 309 409C346 425 370 422 403 399C390 437 344 463 279 466C209 469 163 453 138 425Z" fill="#062c5a" opacity="0.58" />
            <path d="M398 400C431 389 459 388 488 401C461 411 441 426 430 453C424 431 415 413 398 400Z" fill="#062c5a" opacity="0.58" />
          </g>

          <g className="whale whale-small whale-small-b">
            <path d="M19 410C59 382 118 377 164 394C195 405 216 403 241 386C231 419 193 440 140 443C86 447 43 433 19 410Z" fill="#052b56" opacity="0.48" />
            <path d="M238 386C264 377 288 378 312 388C289 397 272 410 263 432C259 413 252 398 238 386Z" fill="#052b56" opacity="0.48" />
          </g>

          <g className="boat-group">
            <path d="M502 126C563 90 643 73 716 86C694 139 639 181 569 197C541 184 519 159 502 126Z" fill="url(#boatGradient)" />
            <path d="M522 129C575 104 633 94 688 101C667 139 625 166 572 181C550 168 534 150 522 129Z" fill="#5d351b" opacity="0.36" />
            <path d="M538 121L579 180M583 108L624 166M627 100L665 145" fill="none" stroke="#ffd27f" strokeLinecap="round" strokeWidth="5" opacity="0.75" />
            <circle cx="599" cy="121" r="15" fill="#f7e3b0" />
            <path d="M588 137C603 137 616 148 626 170" fill="none" stroke="#f7e3b0" strokeLinecap="round" strokeWidth="10" />
            <path d="M579 132C560 146 546 160 535 181" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="10" opacity="0.86" />
            <path d="M614 146C659 166 700 191 735 224" fill="none" stroke="#f5c44f" strokeLinecap="round" strokeWidth="8" />
            <circle cx="735" cy="224" r="9" fill="#f5c44f" />
          </g>

          <g className="foam-dots" fill="#f6df67">
            <circle cx="74" cy="344" r="9" />
            <circle cx="111" cy="296" r="6" />
            <circle cx="328" cy="241" r="8" />
            <circle cx="441" cy="337" r="7" />
            <circle cx="515" cy="226" r="6" />
          </g>
          <g className="bubble-field" fill="#a8f5ef" opacity="0.85">
            <circle cx="126" cy="332" r="7" />
            <circle cx="188" cy="286" r="4" />
            <circle cx="367" cy="217" r="5" />
            <circle cx="418" cy="311" r="4" />
            <circle cx="533" cy="184" r="6" />
            <circle cx="617" cy="230" r="4" />
          </g>
        </svg>
      </div>
    </section>
  );
}
