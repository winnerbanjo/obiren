import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Retention housekeeping. Only data with a documented, self-evident expiry is
 * touched: expired sessions, expired guardian invitations, expired location
 * sessions, expired health shares, expired idempotency records and delivered
 * notification rows past the operational window. User health records are never
 * purged here — erasure stays operator-managed under the approved policy.
 *
 * Execution is double-gated: the caller must ask for `dryRun=false` AND the
 * deployment must set RETENTION_EXECUTION_ENABLED=true.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  async run(dryRun: boolean) {
    const db = this.connection.db;
    if (!db) throw new Error('Database connection unavailable');
    const now = new Date();
    const execute = dryRun === false && process.env.RETENTION_EXECUTION_ENABLED === 'true';

    const targets: Array<{ collection: string; filter: Record<string, unknown>; reason: string }> = [
      { collection: 'sessions', filter: { expiresAt: { $lte: now } }, reason: 'expired refresh session' },
      { collection: 'guardian_invites', filter: { expiresAt: { $lte: new Date(now.getTime() - 30 * 86400000) } }, reason: 'guardian invitation older than its 30-day retention' },
      { collection: 'location_sessions', filter: { expiresAt: { $lte: now } }, reason: 'expired location session' },
      { collection: 'health_shares', filter: { expiresAt: { $lte: new Date(now.getTime() - 30 * 86400000) } }, reason: 'health share 30 days past expiry' },
      { collection: 'health_briefs', filter: { expiresAt: { $lte: new Date(now.getTime() - 30 * 86400000) } }, reason: 'health brief 30 days past expiry' },
      { collection: 'idempotency_records', filter: { expiresAt: { $lte: now } }, reason: 'expired idempotency record' },
      { collection: 'payment_webhook_events', filter: { receivedAt: { $lte: new Date(now.getTime() - 365 * 86400000) } }, reason: 'webhook audit row older than one year' },
    ];

    const results: Array<{ collection: string; reason: string; matched: number; deleted: number }> = [];
    for (const target of targets) {
      const collection = db.collection(target.collection);
      let matched = 0;
      try {
        matched = await collection.countDocuments(target.filter);
      } catch {
        // A missing collection simply has nothing to retain.
        matched = 0;
      }
      let deleted = 0;
      if (execute && matched > 0) {
        const outcome = await collection.deleteMany(target.filter);
        deleted = outcome.deletedCount ?? 0;
      }
      results.push({ collection: target.collection, reason: target.reason, matched, deleted });
    }

    if (execute) {
      this.logger.log(`Retention run deleted ${results.reduce((sum, item) => sum + item.deleted, 0)} record(s)`);
    }

    return {
      success: true,
      data: {
        dryRun: !execute,
        executed: execute,
        executionEnabled: process.env.RETENTION_EXECUTION_ENABLED === 'true',
        ranAt: now.toISOString(),
        results,
        note: execute
          ? 'Expired operational records were deleted. Account health records were not touched.'
          : 'Preview only. Set RETENTION_EXECUTION_ENABLED=true and send dryRun=false to execute; account health records are never purged by this job.',
      },
      meta: this.meta(),
    };
  }
}
