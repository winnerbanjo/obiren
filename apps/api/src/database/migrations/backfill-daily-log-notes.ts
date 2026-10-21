import type { Db } from 'mongodb';
import { encryptHealthNote } from '../../common/crypto/health-data-crypto';

export interface NoteBackfillResult {
  dryRun: boolean;
  scanned: number;
  encrypted: number;
  skippedEmpty: number;
  failed: number;
}

/**
 * Encrypts legacy plaintext `daily_logs.notes`.
 *
 * Idempotent: each document is updated only while its plaintext `notes` field
 * still exists. Re-running finds nothing to do. Documents that already have
 * ciphertext fields are left untouched. In dry-run mode nothing is written.
 */
export async function backfillDailyLogNotes(db: Db, options: { dryRun: boolean }): Promise<NoteBackfillResult> {
  const result: NoteBackfillResult = { dryRun: options.dryRun, scanned: 0, encrypted: 0, skippedEmpty: 0, failed: 0 };
  const cursor = db
    .collection('daily_logs')
    .find({ notes: { $type: 'string' } })
    .project({ _id: 1, notes: 1 });

  for await (const doc of cursor) {
    result.scanned += 1;
    const notes = typeof doc.notes === 'string' ? doc.notes : '';
    if (!notes.trim()) {
      result.skippedEmpty += 1;
      continue;
    }

    let encrypted;
    try {
      encrypted = encryptHealthNote(notes);
    } catch {
      // Missing/invalid key must not partially migrate the collection.
      result.failed += 1;
      throw new Error(
        `Daily-log note encryption requires a valid HEALTH_DATA_ENCRYPTION_KEY; ${result.scanned} document(s) inspected, nothing written for the failing document.`,
      );
    }

    if (options.dryRun) {
      result.encrypted += 1;
      continue;
    }

    // Guard on the plaintext field so concurrent writers/reruns cannot double-apply.
    const update = await db.collection('daily_logs').updateOne(
      { _id: doc._id, notes: { $type: 'string' } },
      {
        $set: {
          notesEncrypted: encrypted.ciphertext,
          notesIv: encrypted.iv,
          notesAuthTag: encrypted.authTag,
          notesKeyId: encrypted.keyId,
        },
        $unset: { notes: '' },
      },
    );
    if (update.modifiedCount === 1) result.encrypted += 1;
  }

  return result;
}
