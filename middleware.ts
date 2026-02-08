// Middleware is intentionally minimal.
// Auth is handled client-side by ConvexAuthProvider (localStorage + ?code= param).
// This file is kept to satisfy Next.js but does not enforce auth redirects.
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
