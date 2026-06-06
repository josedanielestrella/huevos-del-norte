import React from 'react';

export default function BrandLogo({ className = '', compact = false }) {
  return <InlineBrandLogo className={`${className}${compact ? ' brand-logo-compact' : ''}`} compact={compact} />;
}

function InlineBrandLogo({ className = '', compact = false }) {
  const width = compact ? 1368 : 1368;
  const height = compact ? 795 : 795;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Huevos del Norte Siempre fresco"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={width} height={height} fill="#ffffff" />

      <g fill="#f9b233" fontFamily="'Cooper Black', 'Arial Black', Georgia, serif" fontWeight="900" letterSpacing="-8">
        <text x="10" y="250" fontSize="300">Huevos</text>
      </g>

      <g fill="#f9b233" fontFamily="'Cooper Black', 'Arial Black', Georgia, serif" fontWeight="900" letterSpacing="-4">
        <text x="460" y="390" fontSize="170">del</text>
      </g>

      <g fill="#e36b19" fontFamily="'Cooper Black', 'Arial Black', Georgia, serif" fontWeight="900" letterSpacing="-10">
        <text x="85" y="635" fontSize="430">Norte</text>
      </g>

      <g transform="translate(918 214)">
        <path
          d="M0 213 C52 192, 89 148, 132 108 C183 61, 238 34, 293 35 C352 36, 396 70, 410 126 C423 176, 411 233, 394 260 C373 241, 347 223, 309 218 C252 211, 198 225, 155 253 C116 279, 84 319, 56 357 C15 333, -5 279, 0 213 Z"
          fill="#e36b19"
        />
        <path
          d="M190 0 C165 5, 150 30, 151 60 C162 88, 179 111, 203 127 C211 93, 226 66, 251 43 C237 14, 216 -4, 190 0 Z"
          fill="#205f1d"
        />
        <path
          d="M252 0 C225 11, 210 39, 214 73 C229 101, 250 120, 277 131 C282 95, 298 66, 324 42 C309 12, 283 -4, 252 0 Z"
          fill="#205f1d"
        />
        <path
          d="M318 29 C347 37, 369 58, 380 88 C386 119, 380 148, 367 173 C344 142, 316 118, 279 105 C284 72, 296 47, 318 29 Z"
          fill="#205f1d"
        />
        <circle cx="210" cy="273" r="19" fill="#205f1d" />
      </g>

      <text
        x="320"
        y="750"
        fill="#205f1d"
        fontSize="122"
        fontFamily="'Brush Script MT', 'Segoe Script', cursive"
      >
        Siempre fresco
      </text>
    </svg>
  );
}
