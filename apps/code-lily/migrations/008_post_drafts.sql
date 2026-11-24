ALTER TABLE posts ADD COLUMN edit_version INTEGER NOT NULL DEFAULT 1;

CREATE FUNCTION advance_post_edit_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.edit_version := OLD.edit_version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER advance_post_edit_version BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION advance_post_edit_version();

CREATE TABLE post_drafts (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  base_version INTEGER,
  version UUID NOT NULL DEFAULT gen_random_uuid(),
  fields JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((post_id IS NULL AND base_version IS NULL) OR
    (post_id IS NOT NULL AND post_id=id AND base_version IS NOT NULL AND base_version>0))
);

CREATE INDEX post_drafts_owner_updated_idx ON post_drafts(owner_id,updated_at DESC,id);
CREATE INDEX post_drafts_post_id_idx ON post_drafts(post_id);
