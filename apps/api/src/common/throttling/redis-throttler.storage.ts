import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

/** Mirrors @nestjs/throttler's storage record shape (not exported from the root). */
export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

interface MemoryEntry {
  hits: number;
  expiresAt: number;
  blockedUntil: number;
}

/**
 * Throttler storage backed by Redis (shared across instances).
 *
 * If REDIS_URL is not configured (local/test), an in-memory map is used so the
 * API still enforces limits in a single process. If a configured Redis fails
 * at runtime, requests fall back to the in-memory counter rather than taking
 * the API down; the failure is logged without request data.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private redis?: Redis;
  private redisUnavailable = false;

  constructor(redisUrl?: string) {
    if (!redisUrl) return;
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: false,
      });
      this.redis.on('error', (error) => {
        if (!this.redisUnavailable) {
          this.redisUnavailable = true;
          this.logger.warn(`Redis throttling storage unavailable; using in-memory fallback (${error.name})`);
        }
      });
      this.redis.on('ready', () => {
        this.redisUnavailable = false;
      });
    } catch (error: unknown) {
      this.redisUnavailable = true;
      this.logger.warn(`Redis throttling storage could not start; using in-memory fallback (${errorName(error)})`);
    }
  }

  // The guard already namespaces `key` per throttler, so the fifth
  // (throttlerName) argument is not needed here.
  async increment(key: string, ttl: number, limit: number, blockDuration: number): Promise<ThrottlerStorageRecord> {
    if (this.redis && !this.redisUnavailable) {
      try {
        const result = (await this.redis.eval(
          LUA_INCREMENT,
          2,
          `throttle:hits:${key}`,
          `throttle:block:${key}`,
          String(ttl),
          String(limit),
          String(blockDuration),
        )) as [number, number, number, number];
        return {
          totalHits: Number(result[0]),
          timeToExpire: Math.max(1, Math.ceil(Number(result[1]) / 1000)),
          isBlocked: Number(result[2]) === 1,
          timeToBlockExpire: Math.max(0, Math.ceil(Number(result[3]) / 1000)),
        };
      } catch (error: unknown) {
        this.redisUnavailable = true;
        this.logger.warn(`Redis throttling command failed; using in-memory fallback (${errorName(error)})`);
      }
    }
    return this.incrementMemory(key, ttl, limit, blockDuration);
  }

  private incrementMemory(key: string, ttl: number, limit: number, blockDuration: number): ThrottlerStorageRecord {
    const now = Date.now();
    let entry = this.memory.get(key);

    if (!entry || entry.expiresAt <= now) {
      entry = { hits: 0, expiresAt: now + ttl, blockedUntil: 0 };
      this.memory.set(key, entry);
    }

    if (entry.blockedUntil > now) {
      return {
        totalHits: entry.hits,
        timeToExpire: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
        isBlocked: true,
        timeToBlockExpire: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }

    entry.hits += 1;
    if (entry.hits > limit) {
      entry.blockedUntil = now + blockDuration;
    }

    return {
      totalHits: entry.hits,
      timeToExpire: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
      isBlocked: entry.blockedUntil > now,
      timeToBlockExpire: entry.blockedUntil > now ? Math.ceil((entry.blockedUntil - now) / 1000) : 0,
    };
  }

  async close(): Promise<void> {
    this.memory.clear();
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
      this.redis = undefined;
    }
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown_error';
}

const LUA_INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local expiresIn = redis.call('PTTL', KEYS[1])
local blockedFor = redis.call('PTTL', KEYS[2])
local blocked = 0
if blockedFor > 0 then
  blocked = 1
elseif hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blocked = 1
  blockedFor = tonumber(ARGV[3])
end
return {hits, expiresIn, blocked, blockedFor}
`;
