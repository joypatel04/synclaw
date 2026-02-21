# Self-hosted Setup: MCP

## Goal

Enable model/tool interactions through your own MCP server integration.

## Setup flow

1. Deploy MCP server endpoint.
2. Ensure server can reach required tools/services.
3. Configure OpenClaw/MCP details in app settings.
4. Validate tool call behavior using a known-safe test action.

## Verification checklist

- MCP handshake succeeds.
- Tool invocation returns expected structured output.
- Errors are visible and actionable from app surfaces.
- Access constraints are enforced as expected.

## Operational note

Keep logs and metrics for MCP interactions.  
This is critical for debugging and for production reliability.

