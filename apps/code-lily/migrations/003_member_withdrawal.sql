ALTER TABLE blog_schema.posts ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE blog_schema.comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE blog_schema.categories ALTER COLUMN owner_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS comments_author_idx ON blog_schema.comments (author_id);
CREATE INDEX IF NOT EXISTS uploads_owner_idx ON blog_schema.uploads (owner_id, created_at);

CREATE FUNCTION blog_schema.withdraw_member(
  member_id text,
  content_choice text,
  apply_changes boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, blog_schema, pg_temp
AS $$
DECLARE
  member_role text;
  affected_posts bigint;
  published_posts bigint;
  authored_comments bigint;
  dependent_comments bigint;
  owned_uploads bigint;
  owned_categories bigint;
  result jsonb;
BEGIN
  IF member_id IS NULL OR btrim(member_id) = '' OR content_choice IS NULL
     OR content_choice NOT IN ('keep', 'delete') OR apply_changes IS NULL THEN
    RAISE EXCEPTION 'A member ID, a valid content choice and an apply flag are required'
      USING ERRCODE = '22023';
  END IF;

  IF apply_changes THEN
    SELECT role INTO member_role FROM "user" WHERE id = member_id FOR UPDATE;
  ELSE
    SELECT role INTO member_role FROM "user" WHERE id = member_id;
  END IF;
  IF member_role IS NULL THEN
    RETURN jsonb_build_object('status', 'missing');
  END IF;
  IF member_role = 'OWNER' THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'owner_account');
  END IF;

  IF apply_changes THEN
    -- Lock referenced rows before checking for new comments or category assignments.
    PERFORM id FROM categories WHERE owner_id = member_id ORDER BY id FOR UPDATE;
    PERFORM p.id FROM posts p
      WHERE p.author_id = member_id OR EXISTS (
        SELECT 1 FROM comments c WHERE c.author_id = member_id AND c.post_id = p.id
      )
      ORDER BY p.id FOR UPDATE OF p;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'PUBLISHED')
    INTO affected_posts, published_posts FROM posts WHERE author_id = member_id;
  SELECT count(*) INTO authored_comments FROM comments WHERE author_id = member_id;
  SELECT count(*) INTO owned_uploads FROM uploads WHERE owner_id = member_id;
  SELECT count(*) INTO owned_categories FROM categories WHERE owner_id = member_id;
  SELECT count(*) INTO dependent_comments
    FROM posts p JOIN comments c ON c.post_id = p.id
    WHERE p.author_id = member_id AND (content_choice = 'delete' OR p.status <> 'PUBLISHED')
      AND c.author_id IS DISTINCT FROM member_id;

  result := jsonb_build_object(
    'posts', affected_posts, 'publishedPosts', published_posts, 'comments', authored_comments,
    'uploads', owned_uploads, 'categories', owned_categories, 'dependentComments', dependent_comments
  );
  IF owned_uploads > 0 OR dependent_comments > 0 THEN
    RETURN result || jsonb_build_object('status', 'blocked');
  END IF;
  IF NOT apply_changes THEN
    RETURN result || jsonb_build_object('status', 'preview');
  END IF;

  DELETE FROM comments c USING posts p
    WHERE c.author_id = member_id AND p.id = c.post_id
      AND (content_choice = 'delete' OR p.status <> 'PUBLISHED');
  DELETE FROM posts WHERE author_id = member_id
    AND (content_choice = 'delete' OR status <> 'PUBLISHED');

  IF content_choice = 'keep' THEN
    UPDATE posts SET author_id = NULL WHERE author_id = member_id;
    UPDATE comments SET author_id = NULL WHERE author_id = member_id;
  END IF;

  DELETE FROM categories c WHERE c.owner_id = member_id
    AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.category_id = c.id);
  UPDATE categories SET owner_id = NULL WHERE owner_id = member_id;
  UPDATE audit_logs SET entity_id = 'withdrawn'
    WHERE action IN ('member.role.member', 'member.role.editor') AND entity_id = member_id;
  -- Existing foreign keys revoke all sessions and remove linked provider accounts.
  DELETE FROM "user" WHERE id = member_id;

  RETURN result || jsonb_build_object('status', 'applied');
END;
$$;

REVOKE ALL ON FUNCTION blog_schema.withdraw_member(text, text, boolean) FROM PUBLIC;
