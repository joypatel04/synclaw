import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Nightly at 03:00 UTC — purge activity records older than 90 days
crons.daily(
  "purge-old-activities",
  { hourUTC: 3, minuteUTC: 0 },
  internal.cleanup.purgeOldActivities,
  {},
);

// Nightly at 03:15 UTC — purge webhook payload records older than 90 days
crons.daily(
  "purge-old-webhook-payloads",
  { hourUTC: 3, minuteUTC: 15 },
  internal.cleanup.purgeOldWebhookPayloads,
  {},
);

// Nightly at 03:30 UTC — expire pending invites older than 30 days
crons.daily(
  "expire-old-invites",
  { hourUTC: 3, minuteUTC: 30 },
  internal.cleanup.expireOldInvites,
  {},
);

export default crons;
