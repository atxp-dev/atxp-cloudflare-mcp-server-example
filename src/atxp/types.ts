import { Network } from "@atxp/common";
import { McpAgent } from "agents/mcp";

/**
 * Configuration options for initializing ATXP with MCP servers
 */
export interface ATXPMcpConfig {
  /** The wallet address or identifier where payments should be sent */
  fundingDestination: string;
  /** The blockchain network for payments (e.g., 'base', 'ethereum') */
  fundingNetwork: Network;
  /** Display name for the payee (shown to users) */
  payeeName?: string;
  /** Whether to allow HTTP connections (for development) */
  allowHttp?: boolean;
  /** The resource URL for this MCP server (used for context) */
  resourceUrl?: string;
}

/**
 * Authentication context type for ATXP integration with MCP servers
 */
export interface ATXPAuthContext {
  user?: string;
  claims?: {
    sub?: string;
    name?: string;
    [key: string]: any;
  };
  atxpInitParams?: ATXPMcpConfig;  // Pass ATXP initialization params to Durable Object
  [key: string]: unknown;
}

/**
 * Environment interface for Cloudflare Workers with ATXP configuration
 */
export interface ATXPEnv {
  FUNDING_DESTINATION?: string;
  FUNDING_NETWORK?: string;
  ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE?: string;
}

/**
 * Cloudflare Workers ATXP handler function - similar to atxpServer but for Workers
 */
export interface ATXPCloudflareWorkerHandler {
  (request: Request, env: any, ctx: ExecutionContext): Promise<Response | null>;
}

/**
 * Configuration options for ATXP Cloudflare Worker
 */
export interface ATXPCloudflareWorkerOptions<Env = unknown, State = unknown, Props extends Record<string, unknown> = Record<string, unknown>> {
  /** Configuration for ATXP */
  config: ATXPMcpConfig;
  /** The MCP agent class to wrap */
  mcpAgent: typeof McpAgent<Env, State, Props>;
  /** Service name for OAuth metadata */
  serviceName?: string;
  /** Mount paths for MCP endpoints */
  mountPaths?: {
    mcp?: string;
    sse?: string;
    root?: string;
  };
}