import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createEventFileSignedUrl } from "../lib/eventFilesRepository";
import type { EventItem } from "../types";
import { getEventPosterFile } from "../utils/eventPoster";

type PosterSize = "chip" | "filter" | "card" | "header";

interface EventPosterThumbnailProps {
  className?: string;
  event?: EventItem;
  size?: PosterSize;
}

const sizeClasses: Record<PosterSize, string> = {
  card: "h-28 w-full rounded-lg",
  chip: "h-5 w-5 rounded-full",
  filter: "h-10 w-10 rounded-lg",
  header: "h-28 w-full rounded-lg sm:h-32 sm:w-48",
};

const iconSizes: Record<PosterSize, number> = {
  card: 24,
  chip: 12,
  filter: 17,
  header: 28,
};

export function EventPosterThumbnail({
  className = "",
  event,
  size = "card",
}: EventPosterThumbnailProps) {
  const posterFile = getEventPosterFile(event);
  const [signedUrl, setSignedUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const posterSignature = useMemo(
    () => [posterFile?.id, posterFile?.dataUrl, posterFile?.storageBucket, posterFile?.storagePath].join("|"),
    [posterFile],
  );
  const source = posterFile?.dataUrl || signedUrl;

  useEffect(() => {
    let active = true;
    setSignedUrl("");
    setFailed(false);

    if (!posterFile || posterFile.dataUrl || !posterFile.storageBucket || !posterFile.storagePath) return;

    void createEventFileSignedUrl(posterFile)
      .then((url) => {
        if (active) setSignedUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [posterFile, posterSignature]);

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-app-primary/25 bg-app-primary/10 text-blue-200 ${sizeClasses[size]} ${className}`}
      title={posterFile ? `Poster: ${posterFile.name}` : "Event poster not available"}
    >
      {source && !failed ? (
        <img
          alt={event ? `${event.name} poster` : "Event poster"}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
          src={source}
        />
      ) : (
        <CalendarDays size={iconSizes[size]} />
      )}
    </span>
  );
}
