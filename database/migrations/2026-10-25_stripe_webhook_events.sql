-- =============================================================================
-- Migration: Stripe Webhook Events Idempotency Table
-- Date: 2026-10-25
-- Purpose: Provide event-level deduplication and idempotency for Stripe webhooks.
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(event_id);
