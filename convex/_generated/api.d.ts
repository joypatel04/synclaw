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
import type * as agents from "../agents.js";
import type * as apiKeys from "../apiKeys.js";
import type * as apiKeys_internal from "../apiKeys_internal.js";
import type * as auth from "../auth.js";
import type * as broadcasts from "../broadcasts.js";
import type * as chatEvents from "../chatEvents.js";
import type * as chatIngest from "../chatIngest.js";
import type * as chatMessages from "../chatMessages.js";
import type * as documents from "../documents.js";
import type * as folders from "../folders.js";
import type * as http from "../http.js";
import type * as lib_apiAuth from "../lib/apiAuth.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as tasks from "../tasks.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agents: typeof agents;
  apiKeys: typeof apiKeys;
  apiKeys_internal: typeof apiKeys_internal;
  auth: typeof auth;
  broadcasts: typeof broadcasts;
  chatEvents: typeof chatEvents;
  chatIngest: typeof chatIngest;
  chatMessages: typeof chatMessages;
  documents: typeof documents;
  folders: typeof folders;
  http: typeof http;
  "lib/apiAuth": typeof lib_apiAuth;
  "lib/permissions": typeof lib_permissions;
  messages: typeof messages;
  notifications: typeof notifications;
  tasks: typeof tasks;
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
