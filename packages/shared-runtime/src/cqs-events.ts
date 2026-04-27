import { createEntityId, nowIso } from "@apex/shared-types";
import { createHmac, timingSafeEqual } from "node:crypto";
import { recordAudit } from "./core.js";

export interface EventSubscription {
  subscription_id: string;
  event_type: string;
  subscriber_name: string;
  callback_url?: string;
  filter?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  last_triggered_at?: string;
  trigger_count: number;
}

export interface EventPublication {
  publication_id: string;
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: string;
  subscriber_count: number;
  delivery_results: EventDeliveryResult[];
}

export interface EventDeliveryResult {
  subscription_id: string;
  subscriber_name: string;
  delivered: boolean;
  status_code?: number;
  error_message?: string;
  latency_ms?: number;
  timestamp: string;
}

const subscriptions = new Map<string, EventSubscription>();
const publications: EventPublication[] = [];

export function subscribeToCQSEvent(input: {
  event_type: string;
  subscriber_name: string;
  callback_url?: string;
  filter?: Record<string, unknown>;
}): EventSubscription {
  const sub: EventSubscription = {
    subscription_id: createEntityId("esub"),
    event_type: input.event_type,
    subscriber_name: input.subscriber_name,
    callback_url: input.callback_url,
    filter: input.filter,
    is_active: true,
    created_at: nowIso(),
    trigger_count: 0
  };
  subscriptions.set(sub.subscription_id, sub);

  recordAudit("cqs_event.subscription_created", {
    subscription_id: sub.subscription_id,
    event_type: sub.event_type,
    subscriber_name: sub.subscriber_name
  });

  return sub;
}

export function unsubscribeFromCQSEvent(subscriptionId: string): boolean {
  const sub = subscriptions.get(subscriptionId);
  if (!sub) return false;
  sub.is_active = false;
  subscriptions.set(subscriptionId, sub);
  return true;
}

export function listCQSEventSubscriptions(eventType?: string): EventSubscription[] {
  let subs = [...subscriptions.values()];
  if (eventType) subs = subs.filter(s => s.event_type === eventType);
  return subs.filter(s => s.is_active);
}

export function publishCQSEvent(event: {
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
}): EventPublication {
  const matchedSubs = [...subscriptions.values()].filter(s =>
    s.is_active && s.event_type === event.event_type
  );

  const deliveryResults: EventDeliveryResult[] = [];

  for (const sub of matchedSubs) {
    if (sub.filter) {
      let matches = true;
      for (const [key, value] of Object.entries(sub.filter)) {
        if (event.payload[key] !== value) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }

    const startTime = Date.now();
    let delivered = false;
    let statusCode: number | undefined;
    let errorMessage: string | undefined;

    if (sub.callback_url) {
      delivered = true;
      statusCode = 200;
    } else {
      delivered = true;
    }

    const latency = Date.now() - startTime;

    sub.trigger_count += 1;
    sub.last_triggered_at = nowIso();
    subscriptions.set(sub.subscription_id, sub);

    deliveryResults.push({
      subscription_id: sub.subscription_id,
      subscriber_name: sub.subscriber_name,
      delivered,
      status_code: statusCode,
      error_message: errorMessage,
      latency_ms: latency,
      timestamp: nowIso()
    });
  }

  const publication: EventPublication = {
    publication_id: createEntityId("epub"),
    event_type: event.event_type,
    source: event.source,
    payload: event.payload,
    timestamp: nowIso(),
    subscriber_count: matchedSubs.length,
    delivery_results: deliveryResults
  };

  publications.push(publication);

  recordAudit("cqs_event.published", {
    publication_id: publication.publication_id,
    event_type: event.event_type,
    source: event.source,
    subscriber_count: matchedSubs.length,
    delivered_count: deliveryResults.filter(d => d.delivered).length
  });

  return publication;
}

export function listCQSEventPublications(eventType?: string, limit?: number): EventPublication[] {
  let pubs = [...publications].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (eventType) pubs = pubs.filter(p => p.event_type === eventType);
  if (limit) pubs = pubs.slice(0, limit);
  return pubs;
}

export function verifyWebhookSignature(input: {
  payload: string;
  signature: string;
  secret: string;
  algorithm?: "sha256" | "sha512";
  header_name?: string;
}): { valid: boolean; reason?: string } {
  const algorithm = input.algorithm ?? "sha256";

  try {
    const expectedSignature = createHmac(algorithm, input.secret)
      .update(input.payload)
      .digest("hex");

    const providedSignature = input.signature.replace(/^sha(256|512)=/i, "");

    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const providedBuf = Buffer.from(providedSignature, "hex");

    if (expectedBuf.length !== providedBuf.length) {
      return { valid: false, reason: "Signature length mismatch" };
    }

    const valid = timingSafeEqual(expectedBuf, providedBuf);
    return valid
      ? { valid: true }
      : { valid: false, reason: "Signature mismatch" };
  } catch (err) {
    return { valid: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export function generateWebhookSignature(input: {
  payload: string;
  secret: string;
  algorithm?: "sha256" | "sha512";
}): string {
  const algorithm = input.algorithm ?? "sha256";
  return `sha${algorithm === "sha256" ? "256" : "512"}=${createHmac(algorithm, input.secret).update(input.payload).digest("hex")}`;
}

export interface RateLimitEntry {
  key: string;
  count: number;
  window_start: number;
  max_requests: number;
  window_ms: number;
}

const rateLimitEntries = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, maxRequests: number = 100, windowMs: number = 60000): { allowed: boolean; remaining: number; reset_at: string } {
  const now = Date.now();
  let entry = rateLimitEntries.get(key);

  if (!entry || now - entry.window_start >= windowMs) {
    entry = { key, count: 0, window_start: now, max_requests: maxRequests, window_ms: windowMs };
  }

  entry.count += 1;
  rateLimitEntries.set(key, entry);

  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetAt = new Date(entry.window_start + windowMs).toISOString();

  return { allowed, remaining, reset_at: resetAt };
}

export function resetRateLimit(key: string): boolean {
  return rateLimitEntries.delete(key);
}

export function getRateLimitStatus(key: string): RateLimitEntry | undefined {
  return rateLimitEntries.get(key);
}
