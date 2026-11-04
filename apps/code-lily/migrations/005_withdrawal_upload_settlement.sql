ALTER TABLE blog_schema.uploads ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE blog_schema.uploads ADD CONSTRAINT uploads_detached_public_check
  CHECK (owner_id IS NOT NULL OR (
    bucket_kind = 'PUBLIC' AND status = 'READY' AND object_key = 'objects/' || id
  ));
