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

// Simple global context storage for Cloudflare Workers
// Since each Worker handles one request at a time, this is safe
let currentContext: ATXPWorkerContext | null = null;

export function setCurrentRequestWithContext(request: Request, context: ATXPWorkerContext): void {
  currentContext = context;
  console.log(`Set ATXP context with user: ${context.atxpAccountId()}`);
}

// getCurrentRequest function removed - no longer needed with simplified context approach

export function clearCurrentRequest() {
  currentContext = null;
}

export function setATXPWorkerContext(context: ATXPWorkerContext) {
  currentContext = context;
}

export function getATXPWorkerContext(): ATXPWorkerContext | null {
  if (currentContext) {
    console.log(`Retrieved ATXP context with user: ${currentContext.atxpAccountId()}`);
    return currentContext;
  }
  return null;
}


// Helper functions that mirror the Express version
export function getATXPConfig(): ATXPConfig | null {
  const context = getATXPWorkerContext();
  return context?.getATXPConfig() ?? null;
}

export function getATXPResource(): URL | null {
  const context = getATXPWorkerContext();
  return context?.getATXPResource() ?? null;
}

export function atxpAccountId(): string | null {
  const context = getATXPWorkerContext();
  return context?.atxpAccountId() ?? null;
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