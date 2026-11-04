CREATE INDEX IF NOT EXISTS rate_limit_last_request_idx
  ON blog_schema."rateLimit" ("lastRequest", id);
