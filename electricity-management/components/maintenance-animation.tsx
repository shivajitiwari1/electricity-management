"use client";

const NODES = [
  { x: 100, y: 100, r: 14 }, // center hub
  { x: 38,  y: 42,  r: 8  }, // top-left
  { x: 162, y: 42,  r: 8  }, // top-right
  { x: 38,  y: 158, r: 8  }, // bottom-left
  { x: 162, y: 158, r: 8  }, // bottom-right
  { x: 100, y: 22,  r: 6  }, // top
  { x: 100, y: 178, r: 6  }, // bottom
  { x: 22,  y: 100, r: 6  }, // left
  { x: 178, y: 100, r: 6  }, // right
  { x: 60,  y: 72,  r: 5  }, // inner ring tl
  { x: 140, y: 72,  r: 5  }, // inner ring tr
  { x: 60,  y: 128, r: 5  }, // inner ring bl
  { x: 140, y: 128, r: 5  }, // inner ring br
];

const EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4],
  [0, 9], [0, 10], [0, 11], [0, 12],
  [1, 5], [2, 5], [1, 7], [3, 7],
  [2, 8], [4, 8], [3, 6], [4, 6],
  [9, 1], [10, 2], [11, 3], [12, 4],
  [9, 10], [10, 12], [12, 11], [11, 9],
];

export function MaintenanceAnimation() {
  return (
    <div className="flex justify-center items-center w-52 h-52 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer scanning ring */}
        <circle cx="100" cy="100" r="88" fill="none" stroke="#FDE68A" strokeWidth="1" strokeDasharray="12 8" opacity="0.25">
          <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="18s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="78" fill="none" stroke="#F59E0B" strokeWidth="0.75" strokeDasharray="6 14" opacity="0.20">
          <animateTransform attributeName="transform" type="rotate" from="360 100 100" to="0 100 100" dur="12s" repeatCount="indefinite" />
        </circle>

        {/* Edges */}
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x} y1={NODES[a].y}
            x2={NODES[b].x} y2={NODES[b].y}
            stroke="#FCD34D"
            strokeWidth="0.8"
          >
            <animate
              attributeName="opacity"
              values={i % 2 === 0 ? "0.15;0.5;0.15" : "0.4;0.1;0.4"}
              dur={`${2.4 + (i % 7) * 0.4}s`}
              repeatCount="indefinite"
            />
          </line>
        ))}

        {/* Outer nodes */}
        {NODES.slice(1).map((node, i) => (
          <g key={i + 1}>
            <circle cx={node.x} cy={node.y} r={node.r * 2.2} fill="url(#nodeGlow)" opacity="0">
              <animate
                attributeName="opacity"
                values="0;0.5;0"
                dur={`${2 + (i % 5) * 0.6}s`}
                repeatCount="indefinite"
                begin={`${(i % 4) * 0.5}s`}
              />
            </circle>
            <circle cx={node.x} cy={node.y} r={node.r} fill="#FCD34D" filter="url(#glow)">
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur={`${1.8 + (i % 5) * 0.4}s`}
                repeatCount="indefinite"
                begin={`${(i % 4) * 0.3}s`}
              />
            </circle>
          </g>
        ))}

        {/* Center hub glow */}
        <circle cx="100" cy="100" r="30" fill="#FEF3C7" opacity="0.15">
          <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="22" fill="#FEF3C7" opacity="0.25">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.5s" repeatCount="indefinite" begin="0.5s" />
        </circle>

        {/* Center hub */}
        <circle cx="100" cy="100" r={NODES[0].r} fill="#F59E0B" filter="url(#glow)">
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Lightning bolt in center */}
        <path
          d="M103 92 L97 101 L101 101 L97 110 L106 99 L102 99 Z"
          fill="#fff"
          opacity="0.95"
        />
      </svg>
    </div>
  );
}
