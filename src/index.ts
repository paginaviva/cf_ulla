/**
 * Worker-uno - Cloudflare Worker de prueba
 * 
 * Este es el punto de entrada mínimo para el Worker.
 * Implementa un handler básico que responde a solicitudes HTTP.
 */

export interface Env {
  ENVIRONMENT: string;
}

export default {
  /**
   * Handler principal del Worker
   * @param request - La solicitud HTTP entrante
   * @param env - Variables de entorno y bindings
   * @returns Respuesta HTTP
   */
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);
    
    // Ruta de health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          environment: env.ENVIRONMENT,
          worker: 'worker-uno',
          timestamp: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Ruta por defecto
    return new Response(
      JSON.stringify({
        message: 'Worker-uno está funcionando correctamente',
        environment: env.ENVIRONMENT,
        method: request.method,
        path: url.pathname
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
