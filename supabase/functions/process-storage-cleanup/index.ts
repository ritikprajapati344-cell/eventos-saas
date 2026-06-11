import { createClient } from "npm:@supabase/supabase-js@2";

const EVENT_FILES_BUCKET = "event-files";
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_STALE_MINUTES = 10;
const MAX_PARALLEL_DELETIONS = 5;
const WORKER_SECRET_HEADER = "x-storage-cleanup-secret";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CleanupJob = {
  attempts: number;
  id: string;
  source_event_id: string;
  storage_bucket: string;
  storage_path: string;
  workspace_id: string;
};

type JobResult = "completed" | "failed" | "retrying";
type AdminClient = ReturnType<typeof createClient<any>>;

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const workerSecret = Deno.env.get("STORAGE_CLEANUP_WORKER_SECRET");
  if (!workerSecret) {
    return jsonResponse({ error: "Worker configuration is incomplete." }, 503);
  }

  const providedSecret = request.headers.get(WORKER_SECRET_HEADER) ?? "";
  if (!constantTimeEqual(providedSecret, workerSecret)) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase worker configuration is incomplete." }, 503);
  }

  const batchSize = readBoundedInteger("STORAGE_CLEANUP_BATCH_SIZE", DEFAULT_BATCH_SIZE, 1, 100);
  const maxAttempts = readBoundedInteger("STORAGE_CLEANUP_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS, 1, 20);
  const staleMinutes = readBoundedInteger("STORAGE_CLEANUP_STALE_MINUTES", DEFAULT_STALE_MINUTES, 1, 1440);
  const admin: AdminClient = createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error: claimError } = await admin.rpc("claim_storage_cleanup_jobs", {
    requested_batch_size: batchSize,
    requested_max_attempts: maxAttempts,
    stale_after_minutes: staleMinutes,
  });

  if (claimError) {
    console.error("Storage cleanup claim failed.", {
      code: claimError.code,
    });
    return jsonResponse({ error: "Unable to claim Storage cleanup jobs." }, 500);
  }

  const jobs = (data ?? []) as CleanupJob[];
  const results = await mapWithConcurrency(jobs, MAX_PARALLEL_DELETIONS, async (job) => {
    try {
      return await processCleanupJob(admin, job, maxAttempts);
    } catch (error) {
      return markJobFailed(
        admin,
        job,
        maxAttempts,
        sanitizeFailure(error, "Unexpected Storage cleanup failure."),
      );
    }
  });

  const summary = results.reduce(
    (totals, result) => {
      totals[result] += 1;
      return totals;
    },
    { completed: 0, failed: 0, retrying: 0 } satisfies Record<JobResult, number>,
  );

  return jsonResponse({
    claimed: jobs.length,
    completed: summary.completed,
    failed: summary.failed,
    retrying: summary.retrying,
  });
});

async function processCleanupJob(
  admin: AdminClient,
  job: CleanupJob,
  maxAttempts: number,
): Promise<JobResult> {
  const validationError = validateCleanupJob(job);
  if (validationError) {
    return markJobFailed(admin, job, maxAttempts, validationError);
  }

  const { error: storageError } = await admin.storage
    .from(job.storage_bucket)
    .remove([job.storage_path]);

  if (storageError && !isMissingObjectError(storageError)) {
    return markJobFailed(
      admin,
      job,
      maxAttempts,
      sanitizeFailure(storageError, "Storage object deletion failed."),
    );
  }

  const { data: completed, error: completionError } = await admin.rpc(
    "complete_storage_cleanup_job",
    {
      expected_attempt: job.attempts,
      target_job_id: job.id,
    },
  );

  if (completionError || completed !== true) {
    console.error("Storage cleanup completion update failed.", {
      code: completionError?.code,
      jobId: job.id,
    });
    return markJobFailed(
      admin,
      job,
      maxAttempts,
      "Storage object was removed, but the cleanup job could not be completed.",
    );
  }

  return "completed";
}

async function markJobFailed(
  admin: AdminClient,
  job: CleanupJob,
  maxAttempts: number,
  failureMessage: string,
): Promise<JobResult> {
  const { data, error } = await admin.rpc("fail_storage_cleanup_job", {
    expected_attempt: job.attempts,
    failure_message: failureMessage,
    requested_max_attempts: maxAttempts,
    target_job_id: job.id,
  });

  if (error) {
    console.error("Storage cleanup failure update failed.", {
      code: error.code,
      jobId: job.id,
    });
    return "retrying";
  }

  const result = Array.isArray(data) ? data[0] : data;
  return result?.job_status === "failed" ? "failed" : "retrying";
}

function validateCleanupJob(job: CleanupJob) {
  if (job.storage_bucket !== EVENT_FILES_BUCKET) {
    return "Cleanup job bucket is not allowed.";
  }

  const pathParts = job.storage_path.split("/");
  if (
    pathParts.length !== 4
    || pathParts.some((part) => part.trim() === "")
    || pathParts[0] !== job.workspace_id
    || pathParts[1] !== job.source_event_id
    || !UUID_PATTERN.test(pathParts[0])
    || !UUID_PATTERN.test(pathParts[1])
    || !UUID_PATTERN.test(pathParts[2])
  ) {
    return "Cleanup job path is invalid.";
  }

  return null;
}

function isMissingObjectError(error: {
  code?: string;
  message?: string;
  status?: number;
  statusCode?: string | number;
}) {
  const status = Number(error.status ?? error.statusCode);
  const code = String(error.code ?? "").toLowerCase();
  const message = String(error.message ?? "").toLowerCase();
  return status === 404
    || code === "nosuchkey"
    || message.includes("not found")
    || message.includes("does not exist");
}

function sanitizeFailure(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;
  const candidate = error as { code?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code.replace(/[^a-zA-Z0-9_-]/g, "") : "";
  return code ? `${fallback} Code: ${code}.` : fallback;
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function readBoundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(Deno.env.get(name) ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(parsed, maximum));
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(values[currentIndex]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
