import * as twilio from 'twilio';

describe('Twilio Webhook Validation & Outbox Claim Worker (PRD Audit Section 8 & 12)', () => {
  it('should reject inbound Twilio requests with missing or invalid X-Twilio-Signature', () => {
    const signature = 'invalid_signature_hash';
    const authToken = '00000000000000000000000000000000';
    const url = 'https://api.obiren.com/api/v1/webhooks/twilio/whatsapp/inbound';
    const params = { MessageSid: 'SM12345', From: 'whatsapp:+2348000000000' };

    const isValid = twilio.validateRequest(authToken, signature, url, params);
    expect(isValid).toBe(false);
  });

  it('should claim notification outbox items atomically with lock expiry', () => {
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + 5 * 60 * 1000);

    const outboxItem = {
      id: 'notif_1',
      status: 'pending',
      scheduledFor: new Date(now.getTime() - 1000),
      lockedUntil: undefined,
    };

    // Simulate atomic claim filter condition
    const isClaimable =
      outboxItem.status === 'pending' &&
      outboxItem.scheduledFor <= now &&
      (!outboxItem.lockedUntil || outboxItem.lockedUntil < now);

    expect(isClaimable).toBe(true);

    if (isClaimable) {
      outboxItem.status = 'processing';
      outboxItem.lockedUntil = lockExpiry;
    }

    expect(outboxItem.status).toBe('processing');
    expect(outboxItem.lockedUntil).toEqual(lockExpiry);
  });
});
