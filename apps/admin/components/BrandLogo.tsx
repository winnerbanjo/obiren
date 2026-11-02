type BrandLogoProps = {
  /** Render the dancing-figure mark instead of the full wordmark. */
  mark?: boolean;
  /** Render the primary PFP tile: white wordmark on the violet square. */
  pfp?: boolean;
  /** Pixel height of the rendered logo. */
  height?: number;
  /** Color variant; picks the matching transparent PNG from /public/brand. */
  variant?: "white" | "violet" | "dark";
  className?: string;
  priority?: boolean;
};

const ASSETS = {
  white: { src: "/brand/obiren-logo-white.png", ratio: 2143 / 1897 },
  violet: { src: "/brand/obiren-logo-violet.png", ratio: 2143 / 1897 },
  dark: { src: "/brand/obiren-logo-dark.png", ratio: 2143 / 1897 },
} as const;

const MARKS = {
  white: "/brand/obiren-mark-white.png",
  violet: "/brand/obiren-mark-violet.png",
  dark: "/brand/obiren-mark-dark.png",
} as const;

/**
 * The real Obiren logo (woman + star wordmark, from /public/brand).
 * Transparency means one variant works on any background: `white` on dark or
 * violet surfaces, `violet` on light lilac, `dark` on white. The `pfp` form
 * is the primary brand tile (white wordmark on violet) and needs no variant.
 */
export default function BrandLogo({
  mark = false,
  pfp = false,
  height = 28,
  variant = "white",
  className = "",
  priority = false,
}: BrandLogoProps) {
  let src: string;
  let width: number;

  if (pfp) {
    src = "/brand/obiren-pfp.png";
    width = height;
  } else if (mark) {
    src = MARKS[variant];
    width = Math.round(height * (393 / 400));
  } else {
    src = ASSETS[variant].src;
    width = Math.round(height * ASSETS[variant].ratio);
  }

  return (
    // Plain <img> on purpose: the Next dev optimizer intermittently stalls on
    // these requests; the brand PNGs are small and cache well.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Obiren"
      width={width}
      height={height}
      fetchPriority={priority ? "high" : undefined}
      className={pfp ? `rounded-xl ${className}` : className}
      draggable={false}
    />
  );
}
