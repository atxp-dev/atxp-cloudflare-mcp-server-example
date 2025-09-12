import { ATXPConfig, ATXPArgs, TokenCheck, buildServerConfig } from "@atxp/server";
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
  // Override the global fetch to fix Cloudflare Workers context issues
  if (typeof globalThis.fetch !== 'undefined') {
    // Store original fetch in case we need it
    const originalFetch = globalThis.fetch;
    
    // Override global fetch with properly bound version
    // This ensures that internal ATXP HTTP requests work correctly in Cloudflare Workers
    globalThis.fetch = originalFetch.bind(globalThis);
  }
  return buildServerConfig(args);
}