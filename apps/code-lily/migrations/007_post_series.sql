CREATE TABLE post_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  owner_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  UNIQUE (owner_id, name)
);

ALTER TABLE posts
  ADD COLUMN series_id UUID REFERENCES post_series(id),
  ADD COLUMN series_position INTEGER,
  ADD CONSTRAINT posts_series_placement_check CHECK (
    (series_id IS NULL AND series_position IS NULL) OR
    (series_id IS NOT NULL AND series_position IS NOT NULL AND series_position BETWEEN 1 AND 100)
  ),
  ADD CONSTRAINT posts_series_position_key UNIQUE (series_id, series_position);
