SET search_path TO blog_schema, pg_catalog;

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE, image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('MEMBER','EDITOR','OWNER'))
);
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY, "expiresAt" TIMESTAMPTZ NOT NULL, token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress" TEXT, "userAgent" TEXT, "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_idx ON session("userId");
CREATE INDEX IF NOT EXISTS session_expiry_idx ON session("expiresAt");
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT, "refreshToken" TEXT, "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ, "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope TEXT, password TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("providerId","accountId")
);
CREATE INDEX IF NOT EXISTS account_user_idx ON account("userId");
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
CREATE TABLE IF NOT EXISTS "rateLimit" (
  id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, "lastRequest" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL CHECK(length(name)<=60),
  slug TEXT NOT NULL UNIQUE CHECK(length(slug)<=100), owner_id TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(length(title)<=160), excerpt TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL, format TEXT NOT NULL CHECK(format IN ('HTML','MARKDOWN')),
  rendered_html TEXT NOT NULL, tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK(status IN ('DRAFT','PUBLISHED')), category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  author_id TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS posts_archive_idx ON posts(status,published_at DESC);
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS posts_category_idx ON posts(category_id,status,published_at DESC);
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES "user"(id), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS about_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL CHECK(kind IN ('INTRO','EXPERIENCE','INTERESTS','CONTACT','CUSTOM')),
  title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL CHECK(format IN ('HTML','MARKDOWN')), rendered_html TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0, published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), browser_id TEXT NOT NULL, path TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('PAGE_VIEW','HEARTBEAT')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telemetry_time_idx ON telemetry_events(created_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_browser_idx ON telemetry_events(browser_id,created_at DESC);
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id TEXT NOT NULL REFERENCES "user"(id),
  object_key TEXT NOT NULL UNIQUE, bucket_kind TEXT NOT NULL CHECK(bucket_kind IN ('PUBLIC','PRIVATE')),
  content_type TEXT NOT NULL, expected_size INTEGER NOT NULL CHECK(expected_size BETWEEN 1 AND 10485760),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','READY','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
