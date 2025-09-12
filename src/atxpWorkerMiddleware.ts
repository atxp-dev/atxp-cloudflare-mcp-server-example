import { ATXPArgs } from "@atxp/server";
import { buildWorkerATXPConfig, ATXPWorkerContext, setATXPWorkerContext, clearATXPWorkerContext } from "./atxpWorkerContext.js";

export class ATXPWorkerMiddleware {
  private config: any;

  constructor(args: ATXPArgs) {
    this.config = buildWorkerATXPConfig(args);
  }

  async handleRequest(request: Request, env: any): Promise<Response | null> {
    try {
      const logger = this.config.logger;
      const requestUrl = new URL(request.url);
      logger.debug(`ATXP Middleware: Handling ${request.method} ${requestUrl.toString()}`);

      // Clear any existing context
      clearATXPWorkerContext();

      // For now, we'll implement a simplified version that just sets up
      // the ATXP context without full OAuth handling
      // In a full implementation, this would include:
      // - Token validation
      // - OAuth challenge handling  
      // - Protected resource metadata
      
      // Create a basic resource URL
      const resource = new URL(requestUrl.origin);
      
      // For demonstration, we'll create a context without authentication
      // In production, you'd want to implement proper token checking
      const context = new ATXPWorkerContext(this.config, resource);
      setATXPWorkerContext(context);

      logger.debug('ATXP context set up for request');

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
}