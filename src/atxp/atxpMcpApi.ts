import { ATXPWorkerMiddleware } from "./atxpWorkerMiddleware.js";
import { buildWorkerATXPConfig, getATXPWorkerContext } from "./atxpWorkerContext.js";
import { Network } from "@atxp/common";

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
  [key: string]: unknown;
}

/**
 * ATXP API for MCP servers - provides authentication and payment functionality
 */
export class ATXPMcpApi {
  private static middleware: ATXPWorkerMiddleware | null = null;
  private static config: any = null;

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

    const tokenData = atxpWorkerContext.getTokenData();
    return {
      user: atxpWorkerContext.atxpAccountId() || undefined,
      claims: {
        sub: tokenData?.sub,
        name: tokenData?.name,
        ...tokenData, // Include any additional token claims
      }
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
  NODE_ENV?: string;
}

/**
 * Helper function to initialize ATXP from Cloudflare Workers environment
 */
export function initATXPFromEnv(env: ATXPEnv, payeeName?: string): void {
  if (!env.FUNDING_DESTINATION) {
    throw new Error('FUNDING_DESTINATION environment variable not set');
  }
  if (!env.FUNDING_NETWORK) {
    throw new Error('FUNDING_NETWORK environment variable not set');
  }

  ATXPMcpApi.init({
    fundingDestination: env.FUNDING_DESTINATION,
    fundingNetwork: env.FUNDING_NETWORK as Network,
    payeeName: payeeName || 'MCP Server',
    allowHttp: env.NODE_ENV === 'development',
  });
}

/**
 * Cloudflare Workers ATXP handler function - similar to atxpServer but for Workers
 */
export interface ATXPCloudflareWorkerHandler {
  (request: Request, env: any, ctx: ExecutionContext): Promise<Response | null>;
}

export interface ATXPCloudflareWorkerOptions {
  /** Configuration for ATXP */
  config: ATXPMcpConfig;
  /** The MCP agent class to wrap */
  mcpAgent: any;
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
export function atxpCloudflareWorker(options: ATXPCloudflareWorkerOptions) {
  const { 
    config, 
    mcpAgent, 
    serviceName = "ATXP MCP Server",
    mountPaths = { mcp: "/mcp", sse: "/sse", root: "/" }
  } = options;
  
  // Initialize ATXP with the provided config
  if (!ATXPMcpApi.isInitialized()) {
    ATXPMcpApi.init(config);
  }
  
  return {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
      try {
        const url = new URL(request.url);

        // Handle OAuth metadata endpoint BEFORE authentication
        if (url.pathname === "/.well-known/oauth-protected-resource") {
          return ATXPMcpApi.createOAuthMetadata(url.origin + "/", serviceName);
        }

        // Initialize empty auth context
        let authContext: ATXPAuthContext = {};

        // Handle ATXP middleware processing
        try {
          // Check if ATXP middleware should handle this request
          const atxpResponse = await ATXPMcpApi.getMiddleware().handleRequest(request, env);
          if (atxpResponse) {
            return atxpResponse;
          }

          // Extract authentication data from ATXP context
          authContext = ATXPMcpApi.createAuthContext();
        } catch (error) {
          console.error('ATXP middleware error:', error);
        }

        // Create extended context with props for MCP handler
        const extendedCtx = {
          ...ctx,
          props: authContext
        };

        // Route to appropriate MCP endpoints
        if (url.pathname === mountPaths.sse || url.pathname === mountPaths.sse + "/message") {
          return mcpAgent.serveSSE(mountPaths.sse).fetch(request, env, extendedCtx);
        }

        if (url.pathname === mountPaths.mcp) {
          return mcpAgent.serve(mountPaths.mcp).fetch(request, env, extendedCtx);
        }

        // Handle root path for MCP connections
        if (url.pathname === mountPaths.root) {
          return mcpAgent.serve(mountPaths.root).fetch(request, env, extendedCtx);
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
 * Convenience function to create ATXP Cloudflare Worker from environment variables
 * 
 * Usage:
 * ```typescript
 * export default atxpCloudflareWorkerFromEnv({
 *   mcpAgent: MyMCP,
 *   serviceName: "My MCP Server"
 * });
 * ```
 */
export function atxpCloudflareWorkerFromEnv(options: {
  mcpAgent: any;
  serviceName?: string;
  mountPaths?: { mcp?: string; sse?: string; root?: string; };
}) {
  return {
    async fetch(request: Request, env: ATXPEnv, ctx: ExecutionContext): Promise<Response> {
      // Initialize from environment on first request
      if (!ATXPMcpApi.isInitialized()) {
        initATXPFromEnv(env, options.serviceName);
      }

      // Use the main atxpCloudflareWorker function
      const handler = atxpCloudflareWorker({
        config: {
          fundingDestination: env.FUNDING_DESTINATION!,
          fundingNetwork: env.FUNDING_NETWORK as Network,
          payeeName: options.serviceName || 'MCP Server',
          allowHttp: env.NODE_ENV === 'development'
        },
        mcpAgent: options.mcpAgent,
        serviceName: options.serviceName,
        mountPaths: options.mountPaths
      });

      return handler.fetch(request, env, ctx);
    }
  };
}