import type { EventFile, EventItem } from "../types";

const posterKeywords = ["poster", "cover", "banner"];
const supportedImageExtensions = new Set(["jpg", "jpeg", "png"]);
const supportedImageMimeTypes = new Set(["image/jpeg", "image/png"]);

export function getEventPosterFile(event?: EventItem) {
  const imageFiles = (event?.files ?? []).filter(isSupportedPosterImage);
  if (imageFiles.length === 0) return undefined;

  return [...imageFiles].sort((left, right) => getPosterPriority(right) - getPosterPriority(left))[0];
}

export function isSupportedPosterImage(file: EventFile) {
  const fileType = file.fileType.toLowerCase();
  if (supportedImageMimeTypes.has(fileType)) return true;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return supportedImageExtensions.has(extension);
}

function getPosterPriority(file: EventFile) {
  const normalizedName = file.name.toLowerCase();
  const keywordScore = posterKeywords.some((keyword) => normalizedName.includes(keyword)) ? 100 : 0;
  const uploadTime = new Date(file.uploadDate).getTime();
  return keywordScore + (Number.isNaN(uploadTime) ? 0 : uploadTime / 1_000_000_000_000);
}
