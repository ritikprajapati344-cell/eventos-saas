import type { EventFile } from "../types";
import { supabase } from "./supabase";

export const EVENT_FILES_BUCKET = "event-files";
export const EVENT_FILE_MAX_SIZE = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const extensionMimeTypes: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
};

interface EventFileRow {
  event_id: string;
  file_name: string;
  file_size: number | string | null;
  file_type: string;
  id: string;
  storage_bucket: string;
  storage_path: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  workspace_id: string;
}

const eventFileColumns = "id,workspace_id,event_id,file_name,file_type,storage_bucket,storage_path,file_size,uploaded_at,uploaded_by";

export async function listWorkspaceEventFiles(workspaceId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("event_files")
    .select(eventFileColumns)
    .eq("workspace_id", workspaceId)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;
  return (data as EventFileRow[]).map(mapEventFileRow);
}

export async function uploadWorkspaceEventFile(
  workspaceId: string,
  eventId: string,
  userId: string,
  file: File,
) {
  const client = requireSupabase();
  const mimeType = getAllowedEventFileMimeType(file);
  if (!mimeType) {
    throw new Error("Only PDF, JPG, PNG and DOCX files can be uploaded.");
  }
  if (file.size > EVENT_FILE_MAX_SIZE) {
    throw new Error("Event files must be 10 MB or smaller.");
  }

  const fileId = crypto.randomUUID();
  const storagePath = `${workspaceId}/${eventId}/${fileId}/${sanitizeEventFileName(file.name)}`;
  const { error: uploadError } = await client.storage
    .from(EVENT_FILES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data, error: metadataError } = await client
    .from("event_files")
    .insert({
      event_id: eventId,
      file_name: file.name,
      file_size: file.size,
      file_type: mimeType,
      id: fileId,
      storage_bucket: EVENT_FILES_BUCKET,
      storage_path: storagePath,
      uploaded_by: userId,
      workspace_id: workspaceId,
    })
    .select(eventFileColumns)
    .single();

  if (metadataError) {
    const cleanupError = await removeStorageObjects(EVENT_FILES_BUCKET, [storagePath]);
    if (cleanupError) {
      throw new Error(
        `${getErrorMessage(metadataError, "Unable to save file metadata.")} `
        + `The uploaded object could not be cleaned up: ${getErrorMessage(cleanupError, "unknown cleanup error")}`,
      );
    }
    throw metadataError;
  }

  return mapEventFileRow(data as EventFileRow);
}

export async function createEventFileSignedUrl(
  file: EventFile,
  options?: { download?: boolean },
) {
  const client = requireSupabase();
  const bucket = requireStorageBucket(file);
  const path = requireStoragePath(file);
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 60, options?.download ? { download: file.name } : undefined);

  if (error) throw error;
  if (!data.signedUrl) throw new Error("Supabase did not return a signed file URL.");
  return data.signedUrl;
}

export async function deleteWorkspaceEventFile(
  workspaceId: string,
  file: EventFile,
) {
  const client = requireSupabase();
  const bucket = requireStorageBucket(file);
  const path = requireStoragePath(file);
  const storageError = await removeStorageObjects(bucket, [path]);
  if (storageError) throw storageError;

  const { error } = await client
    .from("event_files")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", file.id);

  if (error) throw error;
}

export function getAllowedEventFileMimeType(file: File) {
  if (allowedMimeTypes.has(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return extensionMimeTypes[extension] ?? null;
}

export function sanitizeEventFileName(fileName: string) {
  const normalized = fileName.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
  const lastDot = normalized.lastIndexOf(".");
  const rawBase = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
  const rawExtension = lastDot > 0 ? normalized.slice(lastDot + 1) : "";
  const base = rawBase
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
  const extension = rawExtension.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 12);
  return extension ? `${base}.${extension.toLowerCase()}` : base;
}

function mapEventFileRow(row: EventFileRow): EventFile {
  return {
    eventId: row.event_id,
    fileType: row.file_type,
    id: row.id,
    name: row.file_name,
    size: row.file_size === null ? undefined : Number(row.file_size),
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path ?? undefined,
    uploadDate: row.uploaded_at,
    uploadedBy: row.uploaded_by ?? undefined,
  };
}

async function removeStorageObjects(bucket: string, paths: string[]) {
  if (paths.length === 0) return null;
  const client = requireSupabase();
  const { error } = await client.storage.from(bucket).remove(paths);
  if (!error || isMissingStorageObjectError(error)) return null;
  return error;
}

function requireStorageBucket(file: EventFile) {
  if (!file.storageBucket) throw new Error("The file storage bucket is unavailable.");
  return file.storageBucket;
}

function requireStoragePath(file: EventFile) {
  if (!file.storagePath) throw new Error("The file storage path is unavailable.");
  return file.storagePath;
}

function isMissingStorageObjectError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = "statusCode" in error
    ? Number(error.statusCode)
    : "status" in error
      ? Number(error.status)
      : 0;
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return status === 404 || message.includes("not found") || message.includes("does not exist");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return fallback;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}
