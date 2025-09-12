import { ATXPArgs, ATXPConfig } from "@atxp/server";
import { buildWorkerATXPConfig, ATXPWorkerContext, setATXPWorkerContext, clearATXPWorkerContext } from "./atxpWorkerContext.js";

export class ATXPWorkerMiddleware {
  private config: ATXPConfig;

  constructor(config: ATXPConfig) {
    this.config = config;
  }

  async handleRequest(request: Request, env: any): Promise<Response | null> {
    try {
      const logger = this.config.logger;
      const requestUrl = new URL(request.url);
      logger.debug(`ATXP Middleware: Handling ${request.method} ${requestUrl.toString()}`);

      // Clear any existing context
      clearATXPWorkerContext();

      // Create a basic resource URL
      const resource = new URL(requestUrl.origin);
      
      // Check if this is an MCP request by examining the request
      const isMCPRequest = await this.parseMcpRequest(request, requestUrl);
      logger.debug(`${isMCPRequest.length} MCP requests found in request`);
      
      // If there are no MCP requests, let the request continue without authentication
      if (isMCPRequest.length === 0) {
        logger.debug('No MCP requests found - letting request continue without ATXP processing');
        return null;
      }
      
      // Check the token using proper OAuth logic
      const tokenCheck = await this.checkToken(resource, request);
      const user = tokenCheck.data?.sub ?? null;
      
      logger.debug(`Token check result: passes=${tokenCheck.passes}, user=${user}`);

      // Send OAuth challenge if needed
      const challengeResponse = this.sendOAuthChallenge(tokenCheck, resource);
      if (challengeResponse) {
        logger.debug('Sending OAuth challenge response');
        return challengeResponse;
      }
      
      // Create context with token data (if available)
      const context = new ATXPWorkerContext(this.config, resource, tokenCheck);
      setATXPWorkerContext(context);

      // Store the user ID globally to work around Cloudflare Workers context isolation
      if (user) {
        const { MyMCP } = await import('./index.js');
        MyMCP.currentUserId = user;
        logger.debug(`Stored user ID globally: ${user}`);
      } else {
        // Clear any existing user ID if no valid token
        const { MyMCP } = await import('./index.js');
        MyMCP.currentUserId = null;
      }

      logger.debug(`ATXP context set up for request. User: ${user || 'anonymous'}`);

      // Let the request continue to MCP handling
      return null;

    } catch (error) {
      this.config.logger.error(`Critical error in ATXP middleware: ${error instanceof Error ? error.message : String(error)}`);
      
      return new Response(JSON.stringify({ 
        error: 'server_error', 
        error_description: 'An internal server error occurred in ATXP middleware' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Parse MCP requests from the request body (similar to parseMcpRequests in ATXP server)
  private async parseMcpRequest(request: Request, requestUrl: URL): Promise<any[]> {
    if (!request.method) {
      return [];
    }
    if (request.method.toLowerCase() !== 'post') {
      return [];
    }

    // The middleware has to be mounted at the root to serve the protected resource metadata,
    // but the actual MCP server it's controlling is specified by the mountPath.
    const path = requestUrl.pathname.replace(/\/$/, '');
    const mountPath = this.config.mountPath.replace(/\/$/, '');
    if (path !== mountPath && path !== `${mountPath}/message`) {
      this.config.logger.debug(`Request path (${path}) does not match the mountPath (${mountPath}), skipping MCP middleware`);
      return [];
    }

    try {
      // Clone the request to avoid consuming the body
      const clonedRequest = request.clone();
      const body = await clonedRequest.text();
      
      if (!body) {
        return [];
      }

      const parsedBody = JSON.parse(body);
      
      // Check if it's a JSON-RPC request
      if (parsedBody && typeof parsedBody === 'object') {
        if (Array.isArray(parsedBody)) {
          // Batch request
          return parsedBody.filter(msg => 
            msg && typeof msg === 'object' && 
            msg.jsonrpc === '2.0' && 
            msg.method && 
            msg.id !== undefined
          );
        } else {
          // Single request
          if (parsedBody.jsonrpc === '2.0' && parsedBody.method && parsedBody.id !== undefined) {
            return [parsedBody];
          }
        }
      }
      
      return [];
    } catch (error) {
      this.config.logger.debug(`Error parsing MCP request: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  // Check token (similar to checkToken in ATXP server)
  private async checkToken(resourceURL: URL, request: Request): Promise<any> {
    const protocol = resourceURL.protocol;
    const host = resourceURL.host;
    const pathname = resourceURL.pathname;
    const protectedResourceMetadataUrl = `${protocol}//${host}/.well-known/oauth-protected-resource${pathname}`;

    const failure = {
      passes: false as const,
      resourceMetadataUrl: protectedResourceMetadataUrl,
    };

    // Extract the Bearer token from the Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return {...failure, problem: 'NO_TOKEN', data: null, token: null}
    }
    if (!authHeader.startsWith('Bearer ')) {
      return {...failure, problem: 'NON_BEARER_AUTH_HEADER', data: null, token: null}
    }

    const token = authHeader.substring(7);

    try {
      const introspectionResult = await this.config.oAuthClient.introspectToken(this.config.server, token);
      
      if (!introspectionResult.active) {
        return {...failure, problem: 'INVALID_TOKEN', data: null, token}
      }

      return {
        passes: true,
        data: introspectionResult,
        token,
      };
    } catch (error) {
      this.config.logger.error(`Error during token introspection: ${error}`);
      return {...failure, problem: 'INTROSPECT_ERROR', data: null, token};
    }
  }

  // Send OAuth challenge (similar to sendOAuthChallenge in ATXP server)
  private sendOAuthChallenge(tokenCheck: any, resource: URL): Response | null {
    if (tokenCheck.passes) {
      return null;
    }

    let status = 401;
    let body: {status?: number, error?: string, error_description?: string} = {};
    
    // https://datatracker.ietf.org/doc/html/rfc6750#section-3.1
    switch (tokenCheck.problem) {
      case 'NO_TOKEN':
        break;
      case 'NON_BEARER_AUTH_HEADER':
        status = 400;
        body = { error: 'invalid_request', error_description: 'Authorization header did not include a Bearer token' };
        break;
      case 'INVALID_TOKEN':
        body = { error: 'invalid_token', error_description: 'Token is not active' };
        break;
      case 'INVALID_AUDIENCE':
        body = { error: 'invalid_token', error_description: 'Token does not match the expected audience' };
        break;
      case 'NON_SUFFICIENT_FUNDS':
        status = 403;
        body = { error: 'insufficient_scope', error_description: 'Non sufficient funds' };
        break;
      case 'INTROSPECT_ERROR':
        status = 502;
        body = { error: 'server_error', error_description: 'An internal server error occurred' };
        break;
      default:
        // Unknown problem
        break;
    }

    const wwwAuthenticate = `Bearer resource_metadata="${tokenCheck.resourceMetadataUrl}"`;
    
    return new Response(JSON.stringify(body), {
      status,
      headers: { 
        'Content-Type': 'application/json',
        'WWW-Authenticate': wwwAuthenticate
      }
    });
  }
}