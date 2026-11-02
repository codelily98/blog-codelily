-- EVAL <script> 1 cl:prod:blog:presence:v1 <server-validated-opaque-member>
-- Application service chooses KEYS[1]; do not accept a client-supplied Redis key.
-- ARGV[1] must be produced/validated by the application, never raw IP or token.
local key = KEYS[1]
local member = ARGV[1]
if not key or not member or #member == 0 or #member > 128 then
  return redis.error_reply('invalid presence arguments')
end

local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local window = 300000
-- Inclusive removal means the active window is (now - window, now].
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

-- Keep telemetry cardinality bounded; do not evict a real member to add a new one.
-- This cap is an initial policy, not an estimate of this host's traffic capacity.
local maxMembers = 10000
if not redis.call('ZSCORE', key, member)
  and redis.call('ZCARD', key) >= maxMembers then
  return {now, redis.call('ZCARD', key), 0}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window * 2)
-- Third field: 1 = heartbeat accepted, 0 = cardinality cap reached.
return {now, redis.call('ZCARD', key), 1}
