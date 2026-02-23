/**
 * Convex API function references for the Synclaw backend.
 *
 * These are lightweight references that the ConvexHttpClient uses to call
 * server functions. They match the function paths in the Convex project.
 *
 * Using `anyApi` since this package doesn't have access to the generated types.
 */
import { anyApi } from "convex/server";

export const api = anyApi;
