// Standard MCP clients require admission failures as tool errors. /mcp keeps
// the older direct HTTP payment statuses for existing payment-aware clients.
export const isMcpClientPath = path => path === '/mcp/agent' || path === '/mcp/output-verification';
