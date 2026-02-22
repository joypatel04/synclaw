/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agentSetup from "../agentSetup.js";
import type * as agents from "../agents.js";
import type * as apiKeys from "../apiKeys.js";
import type * as apiKeys_internal from "../apiKeys_internal.js";
import type * as auth from "../auth.js";
import type * as autopilot from "../autopilot.js";
import type * as autopilot_internal from "../autopilot_internal.js";
import type * as billing_razorpay from "../billing_razorpay.js";
import type * as billing_razorpay_internal from "../billing_razorpay_internal.js";
import type * as broadcasts from "../broadcasts.js";
import type * as documents from "../documents.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as lib_apiAuth from "../lib/apiAuth.js";
import type * as lib_autopilot from "../lib/autopilot.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_secretCrypto from "../lib/secretCrypto.js";
import type * as lib_webhooks from "../lib/webhooks.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as openclaw from "../openclaw.js";
import type * as tasks from "../tasks.js";
import type * as webhooks from "../webhooks.js";
import type * as webhooks_internal from "../webhooks_internal.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agentSetup: typeof agentSetup;
  agents: typeof agents;
  apiKeys: typeof apiKeys;
  apiKeys_internal: typeof apiKeys_internal;
  auth: typeof auth;
  autopilot: typeof autopilot;
  autopilot_internal: typeof autopilot_internal;
  billing_razorpay: typeof billing_razorpay;
  billing_razorpay_internal: typeof billing_razorpay_internal;
  broadcasts: typeof broadcasts;
  documents: typeof documents;
  folders: typeof folders;
  http: typeof http;
  "lib/apiAuth": typeof lib_apiAuth;
  "lib/autopilot": typeof lib_autopilot;
  "lib/billing": typeof lib_billing;
  "lib/permissions": typeof lib_permissions;
  "lib/secretCrypto": typeof lib_secretCrypto;
  "lib/webhooks": typeof lib_webhooks;
  messages: typeof messages;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  openclaw: typeof openclaw;
  tasks: typeof tasks;
  webhooks: typeof webhooks;
  webhooks_internal: typeof webhooks_internal;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
