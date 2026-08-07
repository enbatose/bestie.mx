/**
 * Decorative GDL landmarks (Catedral + La Minerva) for the city landing hero.
 * Soft lime line-art — mirrors the Facebook launch banner, never competes with CTAs.
 * Inlined so `currentColor` picks up `text-secondary`.
 */
export function GdlLandmarkSilhouettes({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 select-none overflow-hidden text-secondary ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 240 200"
        fill="none"
        className="absolute bottom-0 left-[-8%] h-[8rem] w-auto opacity-[0.32] sm:left-1 sm:h-[11rem] sm:opacity-[0.38] md:left-4 md:h-[13.5rem] lg:left-8 lg:h-[16rem]"
      >
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 188 H228" />
          <path d="M28 188 V168" />
          <path d="M28 168 C18 168 14 158 18 150 C14 146 16 136 28 138 C32 128 44 130 46 140 C56 138 58 150 52 156 C58 164 48 170 28 168" />
          <path d="M212 188 V170" />
          <path d="M212 170 C202 170 198 160 202 152 C198 148 200 138 212 140 C216 130 228 132 230 142 C238 140 240 150 236 156 C242 164 230 172 212 170" />
          <path d="M78 188 V118 H162 V188" />
          <path d="M78 118 L90 98 H150 L162 118" />
          <path d="M100 98 C100 78 120 68 120 68 C120 68 140 78 140 98" />
          <path d="M120 68 V58" />
          <circle cx="120" cy="54" r="3.5" />
          <path d="M108 96 C110 84 120 76 120 76" />
          <path d="M132 96 C130 84 120 76 120 76" />
          <path d="M42 188 V72 H78 V188" />
          <path d="M42 72 L50 52 H70 L78 72" />
          <path d="M50 52 L60 18 L70 52" />
          <path d="M60 18 V8" />
          <path d="M54 8 H66 M60 4 V12" />
          <path d="M52 168 V148 C52 142 56 138 60 138 C64 138 68 142 68 148 V168" />
          <path d="M52 128 V108 C52 102 56 98 60 98 C64 98 68 102 68 108 V128" />
          <path d="M52 88 V78 C52 74 56 72 60 72 C64 72 68 74 68 78 V88" />
          <path d="M42 100 H36 V188" />
          <path d="M36 100 L42 90" />
          <path d="M162 188 V72 H198 V188" />
          <path d="M162 72 L170 52 H190 L198 72" />
          <path d="M170 52 L180 18 L190 52" />
          <path d="M180 18 V8" />
          <path d="M174 8 H186 M180 4 V12" />
          <path d="M172 168 V148 C172 142 176 138 180 138 C184 138 188 142 188 148 V168" />
          <path d="M172 128 V108 C172 102 176 98 180 98 C184 98 188 102 188 108 V128" />
          <path d="M172 88 V78 C172 74 176 72 180 72 C184 72 188 74 188 78 V88" />
          <path d="M198 100 H204 V188" />
          <path d="M204 100 L198 90" />
          <path d="M104 188 V158 C104 148 112 142 120 142 C128 142 136 148 136 158 V188" />
          <circle cx="120" cy="122" r="10" />
          <path d="M120 112 V132 M110 122 H130" />
          <path d="M112 114 L128 130 M128 114 L112 130" />
          <path d="M86 150 V132 C86 126 90 124 94 124 C98 124 102 126 102 132 V150" />
          <path d="M138 150 V132 C138 126 142 124 146 124 C150 124 154 126 154 132 V150" />
        </g>
      </svg>

      <svg
        viewBox="0 0 200 240"
        fill="none"
        className="absolute bottom-0 right-[-6%] h-[9rem] w-auto opacity-[0.32] sm:right-1 sm:h-[12rem] sm:opacity-[0.38] md:right-4 md:h-[14.5rem] lg:right-8 lg:h-[17rem]"
      >
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="100" cy="220" rx="88" ry="14" />
          <path d="M18 214 C18 204 50 198 100 198 C150 198 182 204 182 214" />
          <ellipse cx="100" cy="198" rx="58" ry="10" />
          <path d="M48 192 C48 184 70 180 100 180 C130 180 152 184 152 192" />
          <path d="M72 180 V168 H128 V180" />
          <path d="M78 168 V128 H122 V168" />
          <rect x="86" y="138" width="28" height="22" rx="2" />
          <path d="M90 149 H110" />
          <path d="M74 128 H126" />
          <path d="M78 128 L82 118 H118 L122 128" />
          <ellipse cx="100" cy="118" rx="22" ry="5" />
          <path d="M100 118 V108" />
          <path d="M88 108 C90 96 94 88 100 86 C106 88 110 96 112 108" />
          <path d="M92 108 L90 118 M108 108 L110 118" />
          <path d="M94 86 C94 76 97 70 100 70 C103 70 106 76 106 86" />
          <path d="M94 78 L78 72" />
          <path d="M106 78 L118 70" />
          <path d="M78 72 C70 74 66 82 68 92 C70 100 76 104 82 100 L78 72" />
          <path d="M72 82 L76 90" />
          <path d="M118 70 V28" />
          <path d="M114 34 L118 28 L122 34" />
          <path d="M118 70 L124 108" />
          <circle cx="100" cy="60" r="8" />
          <path d="M92 56 C92 48 96 44 100 44 C104 44 108 48 108 56" />
          <path d="M100 44 C100 36 106 30 112 28" />
          <path d="M100 44 C104 38 110 34 116 34" />
        </g>
      </svg>
    </div>
  );
}
