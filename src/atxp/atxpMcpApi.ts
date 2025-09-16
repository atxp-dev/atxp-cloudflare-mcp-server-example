import { ATXPWorkerMiddleware } from "./atxpWorkerMiddleware.js";
import { buildWorkerATXPConfig, getATXPWorkerContext, atxpAccountId } from "./atxpWorkerContext.js";
import { Network } from "@atxp/common";
import { McpAgent } from "agents/mcp";
import { ATXPConfig } from "@atxp/server";

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
 * ATXP API for MCP servers - provides authentication and payment functionality
 */
export class ATXPMcpApi {
  private static middleware: ATXPWorkerMiddleware | null = null;
  private static config: ATXPConfig | null = null;

  /**
   * Initialize ATXP middleware for MCP server
   */
  static init(options: ATXPMcpConfig): void {
    if (!options.fundingDestination) {
      throw new Error('fundingDestination is required for ATXP initialization');
    }
    if (!options.fundingNetwork) {
      throw new Error('fundingNetwork is required for ATXP initialization');
    }

    const atxpArgs = {
      destination: options.fundingDestination,
      network: options.fundingNetwork,
      payeeName: options.payeeName || 'MCP Server',
      allowHttp: options.allowHttp || false,
    };

    // Build config once and reuse it
    ATXPMcpApi.config = buildWorkerATXPConfig(atxpArgs);
    ATXPMcpApi.middleware = new ATXPWorkerMiddleware(ATXPMcpApi.config);
  }

  /**
   * Get the ATXP middleware instance (must call init() first)
   */
  static getMiddleware(): ATXPWorkerMiddleware {
    if (!ATXPMcpApi.middleware) {
      throw new Error('ATXP not initialized - call ATXPMcpApi.init() first');
    }
    return ATXPMcpApi.middleware;
  }

  /**
   * Get the ATXP configuration (must call init() first)
   */
  static getConfig(): any {
    if (!ATXPMcpApi.config) {
      throw new Error('ATXP not initialized - call ATXPMcpApi.init() first');
    }
    return ATXPMcpApi.config;
  }

  /**
   * Create authentication context from ATXP worker context
   * This should be called after ATXP middleware processing
   */
  static createAuthContext(): ATXPAuthContext {
    const atxpWorkerContext = getATXPWorkerContext();

    if (!atxpWorkerContext) {
      return {};
    }

    const tokenData = atxpWorkerContext.tokenData;
    return {
      user: atxpAccountId() || undefined,
      claims: tokenData || undefined
    };
  }

  /**
   * Create OAuth metadata response for the resource
   */
  static createOAuthMetadata(resourceUrl: string, resourceName?: string): Response {
    const metadata = {
      resource: resourceUrl,
      resource_name: resourceName || "ATXP MCP Server",
      authorization_servers: ["https://auth.atxp.ai"],
      bearer_methods_supported: ["header"],
      scopes_supported: ["read", "write"],
    };

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  /**
   * Check if ATXP is initialized
   */
  static isInitialized(): boolean {
    return ATXPMcpApi.middleware !== null && ATXPMcpApi.config !== null;
  }

  /**
   * Reset ATXP state (useful for testing)
   */
  static reset(): void {
    ATXPMcpApi.middleware = null;
    ATXPMcpApi.config = null;
  }
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

/**
 * Cloudflare Workers equivalent of atxpServer() - wraps an MCP server with ATXP authentication and payments
 * 
 * Usage:
 * ```typescript
 * export default atxpCloudflareWorker({
 *   config: { fundingDestination: "0x...", fundingNetwork: "base" },
 *   mcpAgent: MyMCP,
 *   serviceName: "My MCP Server"
 * });
 * ```
 */
export function atxpCloudflareWorker<Env = unknown, State = unknown, Props extends Record<string, unknown> = Record<string, unknown>>(options: ATXPCloudflareWorkerOptions<Env, State, Props>) {
  const {
    config,
    mcpAgent,
    serviceName = "ATXP MCP Server",
    mountPaths = { mcp: "/mcp", sse: "/sse", root: "/" }
  } = options;

  // Destructure mount paths with guaranteed defaults
  const { mcp = "/mcp", sse = "/sse", root = "/" } = mountPaths;
  
  return {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
      try {
        // Initialize ATXP for each request in case of Cloudflare Workers isolation
        if (!ATXPMcpApi.isInitialized()) {
          ATXPMcpApi.init(config);
        }
        
        const url = new URL(request.url);
        const resourceUrl = url.origin + "/";

        // Handle OAuth metadata endpoint BEFORE authentication
        if (url.pathname === "/.well-known/oauth-protected-resource") {
          return ATXPMcpApi.createOAuthMetadata(resourceUrl, serviceName);
        }

        // Initialize empty auth context
        let authContext: ATXPAuthContext = {};

        // Handle ATXP middleware processing
        try {
          // Check if ATXP middleware should handle this request
          const atxpResponse = await ATXPMcpApi.getMiddleware().handleRequest(request);
          if (atxpResponse) {
            return atxpResponse;
          }

          // Extract authentication data from ATXP context
          authContext = ATXPMcpApi.createAuthContext();
        } catch (error) {
          console.error('ATXP middleware error:', error);
        }

        // Create extended context with props and ATXP initialization params for MCP handler
        // Note: We pass the original config options rather than the built config
        // because the built config contains class instances that don't serialize
        const extendedCtx = {
          ...ctx,
          props: {
            ...authContext,
            atxpInitParams: {
              ...config,
              resourceUrl  // Pass consistent resource URL
            }
          }
        };

        // Route to appropriate MCP endpoints
        if (url.pathname === sse || url.pathname === sse + "/message") {
          return mcpAgent.serveSSE(sse).fetch(request, env, extendedCtx);
        }

        if (url.pathname === mcp) {
          return mcpAgent.serve(mcp).fetch(request, env, extendedCtx);
        }

        // Handle root path for MCP connections
        if (url.pathname === root) {
          return mcpAgent.serve(root).fetch(request, env, extendedCtx);
        }

        return new Response("Not found", { status: 404 });

      } catch (error) {
        console.error('Error in ATXP Cloudflare Worker handler:', error);
        return new Response(JSON.stringify({
          error: 'server_error',
          error_description: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };
}

/**
 * Convenience function to create ATXP Cloudflare Worker with environment-based configuration
 * 
 * Usage:
 * ```typescript
 * export default {
 *   async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
 *     const handler = atxpCloudflareWorkerFromEnv({
 *       mcpAgent: MyMCP,
 *       serviceName: "My MCP Server",
 *       allowHttp: env.ALLOW_INSECURE_HTTP_REQUESTS_DEV_ONLY_PLEASE === 'true',
 *       fundingDestination: env.FUNDING_DESTINATION,
 *       fundingNetwork: env.FUNDING_NETWORK
 *     });
 *     return handler.fetch(request, env, ctx);
 *   }
 * };
 * ```
 */
export function atxpCloudflareWorkerFromEnv<Env = unknown, State = unknown, Props extends Record<string, unknown> = Record<string, unknown>>(options: {
  mcpAgent: typeof McpAgent<Env, State, Props>;
  serviceName?: string;
  mountPaths?: { mcp?: string; sse?: string; root?: string; };
  allowHttp?: boolean;
  fundingDestination: string;
  fundingNetwork: Network;
}) {
  return {
    async fetch(request: Request, env: ATXPEnv, ctx: ExecutionContext): Promise<Response> {
      // Use the main atxpCloudflareWorker function with parameter-based config
      const handler = atxpCloudflareWorker({
        config: {
          fundingDestination: options.fundingDestination,
          fundingNetwork: options.fundingNetwork,
          payeeName: options.serviceName || 'MCP Server',
          allowHttp: options.allowHttp || false
        },
        mcpAgent: options.mcpAgent,
        serviceName: options.serviceName,
        mountPaths: options.mountPaths
      });

      return handler.fetch(request, env, ctx);
    }
  };
}