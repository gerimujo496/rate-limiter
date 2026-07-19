export const tokenBucketLuaScript = `
local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refillPeriodSeconds = tonumber(ARGV[2])
local currentTimeSeconds = tonumber(ARGV[3])
local requestedTokens = tonumber(ARGV[4])
local keyTtlSeconds = tonumber(ARGV[5])

if not capacity or capacity <= 0 then
    return redis.error_reply("capacity must be a positive number")
end

if not refillPeriodSeconds or refillPeriodSeconds <= 0 then
    return redis.error_reply("refillPeriodSeconds must be a positive number")
end

if not currentTimeSeconds then
    return redis.error_reply("currentTimeSeconds must be a number")
end

if not requestedTokens or requestedTokens <= 0 then
    return redis.error_reply("requestedTokens must be a positive number")
end

if not keyTtlSeconds or keyTtlSeconds <= 0 then
    return redis.error_reply("keyTtlSeconds must be a positive number")
end

local storedBucket = redis.call("GET", key)

local currentTokens
local lastRefillTimestamp

if not storedBucket then
    -- A new bucket starts full.
    currentTokens = capacity
    lastRefillTimestamp = currentTimeSeconds
else
    local ok, bucket = pcall(cjson.decode, storedBucket)

    if ok and type(bucket) == "table" then
        currentTokens = tonumber(bucket.tokenCount)
        lastRefillTimestamp = tonumber(bucket.lastRefillTimestamp)
    end

    -- Corrupt or legacy values: reset to a full bucket.
    if not currentTokens or not lastRefillTimestamp then
        currentTokens = capacity
        lastRefillTimestamp = currentTimeSeconds
    end
end

-- Example:
-- capacity = 10
-- refillPeriodSeconds = 60
-- One token is restored every 6 seconds.
local secondsPerToken = refillPeriodSeconds / capacity

local elapsedSeconds = math.max(
    0,
    currentTimeSeconds - lastRefillTimestamp
)

-- Only add complete tokens.
local tokensToAdd = math.floor(
    elapsedSeconds / secondsPerToken
)

if tokensToAdd > 0 then
    currentTokens = math.min(
        capacity,
        currentTokens + tokensToAdd
    )

    -- Preserve unused elapsed time.
    lastRefillTimestamp =
        lastRefillTimestamp +
        (tokensToAdd * secondsPerToken)

    -- When full, unused time should not accumulate indefinitely.
    if currentTokens >= capacity then
        currentTokens = capacity
        lastRefillTimestamp = currentTimeSeconds
    end
end

local allowed = 0

if currentTokens >= requestedTokens then
    currentTokens = currentTokens - requestedTokens
    allowed = 1
end

local retryAfterSeconds = 0

if allowed == 0 then
    local missingTokens = requestedTokens - currentTokens

    retryAfterSeconds = math.ceil(
        missingTokens * secondsPerToken -
        (currentTimeSeconds - lastRefillTimestamp)
    )

    retryAfterSeconds = math.max(1, retryAfterSeconds)
end

local updatedBucket = {
    tokenCount = currentTokens,
    lastRefillTimestamp = lastRefillTimestamp
}

-- Sliding idle TTL: each request refreshes expiry. After the idle window,
-- Redis evicts the key; the next request recreates a full bucket, which is
-- equivalent to a fully refilled one.
redis.call(
    "SET",
    key,
    cjson.encode(updatedBucket),
    "EX",
    keyTtlSeconds
)

return {
    allowed,
    currentTokens,
    retryAfterSeconds
}
`;
