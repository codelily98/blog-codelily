-- Better Auth stores lastRequest as Unix milliseconds.
WITH cutoff AS (
  SELECT floor(extract(epoch FROM (now() - interval '24 hours')) * 1000)::bigint AS ms
), expired AS (
  SELECT id
  FROM blog_schema."rateLimit"
  WHERE "lastRequest" < (SELECT ms FROM cutoff)
  ORDER BY "lastRequest", id
  LIMIT 5000
)
DELETE FROM blog_schema."rateLimit" AS entry
USING expired
WHERE entry.id = expired.id
  -- Recheck in case a concurrent login refreshed a selected entry.
  AND entry."lastRequest" < (SELECT ms FROM cutoff);
