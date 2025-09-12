import { ConsoleLogger, OAuthResourceClient, DEFAULT_AUTHORIZATION_SERVER, MemoryOAuthDb } from "@atxp/common";
import { ATXPConfig, ATXPArgs, TokenCheck, TokenCheckPass } from "@atxp/server";
import { buildServerConfig } from "@atxp/server";

// Store the ATXP context in the request context since Cloudflare Workers 
// don't support AsyncLocalStorage
export class ATXPWorkerContext {
  private config: ATXPConfig;
  private tokenData: any | null = null;
  private resource: URL;

  constructor(config: ATXPConfig, resource: URL, tokenCheck?: TokenCheck) {
    this.config = config;
    this.resource = resource;
    this.tokenData = tokenCheck?.data || null;
  }

  getATXPConfig(): ATXPConfig {
    return this.config;
  }

  getATXPResource(): URL {
    return this.resource;
  }

  atxpAccountId(): string | null {
    return this.tokenData?.sub ?? null;
  }

  getTokenData() {
    return this.tokenData;
  }
}

// Global context holder - in a real implementation, you might want to use
// Durable Objects or another mechanism to maintain state per request
let currentContext: ATXPWorkerContext | null = null;

export function setATXPWorkerContext(context: ATXPWorkerContext) {
  currentContext = context;
}

export function getATXPWorkerContext(): ATXPWorkerContext | null {
  return currentContext;
}

export function clearATXPWorkerContext() {
  currentContext = null;
}

// Helper functions that mirror the Express version
export function getATXPConfig(): ATXPConfig | null {
  return currentContext?.getATXPConfig() ?? null;
}

export function getATXPResource(): URL | null {
  return currentContext?.getATXPResource() ?? null;
}

export function atxpAccountId(): string | null {
  return currentContext?.atxpAccountId() ?? null;
}

// Build configuration for Cloudflare Workers
export function buildWorkerATXPConfig(args: ATXPArgs): ATXPConfig {
  return buildServerConfig(args);
}