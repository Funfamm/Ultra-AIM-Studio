import type { PageMediaItem } from "@/lib/page-media";
import "./page-media.css";

interface Props {
  item:         PageMediaItem;
  className?:   string;
  imgClassName?: string;
  loading?:     "eager" | "lazy";
}

export default function PageMediaImage({
  item,
  className,
  imgClassName,
  loading = "lazy",
}: Props) {
  const url = item.imageUrl || item.posterUrl;
  if (!url) return null;

  const deviceClass =
    item.deviceTarget === "DESKTOP" ? "pm-desktop-only"
    : item.deviceTarget === "MOBILE"  ? "pm-mobile-only"
    : "";

  const wrapClass = [deviceClass, className].filter(Boolean).join(" ");

  return (
    <div className={wrapClass || undefined}>
      <img
        src={url}
        alt={item.altText || ""}
        className={imgClassName}
        loading={loading}
        decoding="async"
      />
    </div>
  );
}
