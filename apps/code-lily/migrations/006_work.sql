SET search_path TO blog_schema, pg_catalog;

CREATE TABLE work_space (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);
INSERT INTO work_space(id) VALUES (1);

CREATE TABLE work_node (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES work_node(id),
  node_type TEXT NOT NULL CHECK (node_type IN ('FOLDER', 'DOCUMENT')),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  journal_date DATE UNIQUE,
  system_key TEXT UNIQUE,
  deleted_at TIMESTAMPTZ,
  delete_batch UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id IS DISTINCT FROM parent_id),
  CHECK ((deleted_at IS NULL) = (delete_batch IS NULL)),
  CHECK (journal_date IS NULL OR node_type = 'DOCUMENT'),
  CHECK (system_key IS NULL OR node_type = 'FOLDER')
);
CREATE UNIQUE INDEX work_node_sibling_name ON work_node(parent_id, name)
  NULLS NOT DISTINCT WHERE deleted_at IS NULL;
CREATE INDEX work_node_parent_order ON work_node(parent_id, sort_order, id);
CREATE INDEX work_node_trash ON work_node(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE work_document (
  node_id UUID PRIMARY KEY REFERENCES work_node(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 100000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Maintenance can expire bounded leaves without reading document contents.
CREATE FUNCTION blog_schema.prune_work_trash() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, blog_schema
AS $$
DECLARE removed INTEGER;
BEGIN
  PERFORM id FROM blog_schema.work_space WHERE id = 1 FOR UPDATE;
  DELETE FROM blog_schema.work_node WHERE id IN (
    SELECT n.id FROM blog_schema.work_node n
    WHERE n.deleted_at < now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM blog_schema.work_node c WHERE c.parent_id = n.id)
    ORDER BY n.deleted_at, n.id LIMIT 500
  );
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    UPDATE blog_schema.work_space SET version = version + 1 WHERE id = 1;
  END IF;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION blog_schema.prune_work_trash() FROM PUBLIC;
