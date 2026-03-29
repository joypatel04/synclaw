export const SYNCLAW_MCP_SERVER_PACKAGE = "@synclaw/mcp-server";
// Pin the version in templates to avoid surprise breaking changes when users run `npx`.
// Update this when you intentionally release a new compatible MCP server version.
export const SYNCLAW_MCP_SERVER_VERSION = "0.6.5";
export const SYNCLAW_MCP_SERVER_NPX_SPEC = `${SYNCLAW_MCP_SERVER_PACKAGE}@${SYNCLAW_MCP_SERVER_VERSION}`;