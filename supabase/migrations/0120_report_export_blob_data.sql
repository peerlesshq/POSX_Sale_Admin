-- BE-66/67: add durable blob storage for report exports.
--
-- The previous implementation used an in-memory Map that was lost on
-- every edge-function cold start. This column stores the CSV/JSON
-- export data directly on the job row. For reports under ~1 MB this
-- is the simplest durable fix with no external dependencies. Large
-- reports (>5 MB) should migrate to Supabase Storage in a follow-up.

ALTER TABLE report_export_jobs
  ADD COLUMN IF NOT EXISTS blob_data text;

COMMENT ON COLUMN report_export_jobs.blob_data IS
  'Raw export content (CSV/JSON). Stored inline for durability across cold starts.';
