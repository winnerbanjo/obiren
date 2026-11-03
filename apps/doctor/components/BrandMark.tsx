/**
 * The Obiren app icon: the same mark the browser tab, the app store listing
 * and the marketing site show. Copied from `app/icon.png` to
 * `/public/brand/obiren-app-icon.png` so the portal matches the product.
 *
 * Decorative next to the "Obiren" wordmark, so it is hidden from assistive
 * technology.
 */
export default function BrandMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // Plain <img>: the icon is a small PNG that caches well, and the Next image
    // optimizer adds nothing for a fixed square mark.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/obiren-app-icon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`rounded-[24%] shrink-0 ${className}`}
      draggable={false}
    />
  );
}
