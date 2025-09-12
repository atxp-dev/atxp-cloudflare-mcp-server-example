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