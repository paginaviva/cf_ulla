/**
 * wk-api-inmo - Cloudflare Worker principal para ApiInmoBase
 *
 * Punto de entrada API HTTP que:
 * - Valida tokens de API mediante KV
 * - Inicia Workflows para procesamiento durable
 * - Consulta estados y resultados
 * - Almacena resultados en R2
 */

// Exportar la clase del Workflow para el binding
export { WfApiInmo, type WorkflowParams } from "./workflow";

/**
 * Interface de entorno con todos los bindings y variables
 */
export interface Env {
  // Bindings de recursos Cloudflare
  WF_API_INMO: Workflow;
  DIR_API_INMO: R2Bucket;
  SECRETS_API_INMO: KVNamespace;

  // Variables de entorno
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

/**
 * Headers CORS para todas las respuestas
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * Payload para el workflow
 */
interface ScrapeRequest {
  url?: string;
}

/**
 * Respuesta de error estandarizada
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: string | string[];
  };
}

/**
 * Valida el formato de UUID v4
 * @param uuid - String a validar
 * @returns true si es UUID v4 válido
 */
function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Valida el formato de URL
 * @param urlString - URL a validar
 * @returns true si es URL válida con esquema http/https
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Valida el token de API desde el header Authorization
 * @param request - Request HTTP entrante
 * @param env - Environment bindings
 * @returns true si el token es válido, false en caso contrario
 */
async function validateApiToken(
  request: Request,
  env: Env
): Promise<boolean> {
  // Extraer header Authorization
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return false;
  }

  // Parsear token del formato "Bearer <token>"
  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return false;
  }

  const providedToken = parts[1];

  if (!providedToken) {
    return false;
  }

  // Leer token almacenado desde KV
  const storedToken = await env.SECRETS_API_INMO.get("TOKEN-API-INMO");

  if (!storedToken) {
    // Token no configurado en KV - error de configuración
    console.error("[Auth] TOKEN-API-INMO no configurado en KV");
    return false;
  }

  // Comparar tokens
  return providedToken === storedToken;
}

/**
 * Crea respuesta de error estandarizada
 * @param code - Código de error
 * @param message - Mensaje descriptivo
 * @param details - Detalles adicionales
 * @param status - Código HTTP
 * @returns Response HTTP
 */
function createErrorResponse(
  code: string,
  message: string,
  details: string | string[],
  status: number
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        details
      }
    } as ErrorResponse),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}

export default {
  /**
   * Handler principal del Worker
   * @param request - La solicitud HTTP entrante
   * @param env - Variables de entorno y bindings
   * @param ctx - ExecutionContext
   * @returns Respuesta HTTP
   */
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Log de inicio de petición
    console.log("[Request] Inicio", {
      method,
      path: pathname,
      timestamp: new Date().toISOString()
    });

    // Manejar requests OPTIONS (preflight CORS)
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Ruta de health check
    if (pathname === "/health") {
      return this.handleHealth(env);
    }

    // POST /scrape - Iniciar procesamiento de URL
    if (method === "POST" && pathname === "/scrape") {
      return this.handleScrape(request, env);
    }

    // GET /status/:id - Consultar estado de ejecución
    if (method === "GET" && pathname.startsWith("/status/")) {
      const id = pathname.split("/")[2];
      return this.handleStatus(id, env);
    }

    // GET /result/:id - Recuperar resultado JSON
    if (method === "GET" && pathname.startsWith("/result/")) {
      const id = pathname.split("/")[2];
      return this.handleResult(id, env);
    }

    // Ruta por defecto - 404
    return createErrorResponse(
      "NOT_FOUND",
      "Endpoint no encontrado",
      "El endpoint solicitado no existe en esta API",
      404
    );
  },

  /**
   * Handler para health check
   * @param env - Environment bindings
   * @returns Response HTTP
   */
  async handleHealth(env: Env): Promise<Response> {
    return new Response(
      JSON.stringify({
        status: "healthy",
        environment: env.ENVIRONMENT,
        worker: "wk-api-inmo",
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  },

  /**
   * Handler para POST /scrape
   * Inicia el procesamiento de una URL
   * @param request - Request HTTP
   * @param env - Environment bindings
   * @returns Response HTTP
   */
  async handleScrape(request: Request, env: Env): Promise<Response> {
    try {
      // 1. Validar token de API
      console.log("[Scrape] Validando token de API");
      const tokenValid = await validateApiToken(request, env);

      if (!tokenValid) {
        console.log("[Scrape] Token inválido - rechazando petición");
        return createErrorResponse(
          "UNAUTHORIZED",
          "Token de API inválido o no proporcionado",
          "El header Authorization debe contener un token válido",
          401
        );
      }

      console.log("[Scrape] Token válido - continuando");

      // 2. Validar Content-Type
      const contentType = request.headers.get("Content-Type");
      if (!contentType || !contentType.includes("application/json")) {
        return createErrorResponse(
          "BAD_REQUEST",
          "Content-Type inválido",
          "El Content-Type debe ser application/json",
          400
        );
      }

      // 3. Parsear body JSON
      let body: ScrapeRequest;
      try {
        body = await request.json();
      } catch (error) {
        console.log("[Scrape] Error parseando JSON:", error instanceof Error ? error.message : "Unknown error");
        return createErrorResponse(
          "BAD_REQUEST",
          "Body JSON inválido",
          "El body debe ser un JSON válido",
          400
        );
      }

      // 4. Validar campo url
      if (!body.url) {
        return createErrorResponse(
          "BAD_REQUEST",
          "Entrada inválida",
          ["El campo 'url' es requerido"],
          400
        );
      }

      if (typeof body.url !== "string") {
        return createErrorResponse(
          "BAD_REQUEST",
          "Entrada inválida",
          ["El campo 'url' debe ser una cadena de texto"],
          400
        );
      }

      // 5. Validar formato de URL
      if (!isValidUrl(body.url)) {
        return createErrorResponse(
          "BAD_REQUEST",
          "Entrada inválida",
          ["El campo 'url' debe ser una URL válida con esquema http o https"],
          400
        );
      }

      // 6. Generar UUID v4
      const executionId = crypto.randomUUID();
      console.log("[Scrape] UUID generado:", executionId);

      // 7. Iniciar Workflow
      console.log("[Scrape] Iniciando Workflow");
      try {
        const workflow = env.WF_API_INMO;
        const instance = await workflow.create({
          id: executionId,
          params: {
            url: body.url,
            executionId: executionId
          }
        });

        console.log("[Scrape] Workflow iniciado correctamente:", {
          executionId,
          instanceId: instance.id,
          url: body.url
        });

        // 8. Devolver respuesta inicial
        return new Response(
          JSON.stringify({
            id: executionId,
            status: "started",
            message: "Procesamiento iniciado correctamente"
          }),
          {
            status: 202,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      } catch (workflowError) {
        console.error("[Scrape] Error iniciando Workflow:", workflowError instanceof Error ? workflowError.message : "Unknown error");
        return createErrorResponse(
          "WORKFLOW_ERROR",
          "Error al iniciar Workflow",
          "No se pudo iniciar la instancia de Workflow",
          500
        );
      }
    } catch (error) {
      console.error("[Scrape] Error interno:", error instanceof Error ? error.message : "Unknown error");
      return createErrorResponse(
        "INTERNAL_ERROR",
        "Error interno del servidor",
        "Se produjo un error inesperado. Intente nuevamente más tarde",
        500
      );
    }
  },

  /**
   * Handler para GET /status/:id
   * Consulta el estado de una ejecución
   * @param id - UUID de la ejecución
   * @param env - Environment bindings
   * @returns Response HTTP
   */
  async handleStatus(id: string, env: Env): Promise<Response> {
    try {
      // 1. Validar token de API
      console.log("[Status] Validando token de API para ID:", id);

      // 2. Validar formato UUID
      if (!isValidUuid(id)) {
        console.log("[Status] UUID inválido:", id);
        return createErrorResponse(
          "BAD_REQUEST",
          "ID de ejecución inválido",
          "El ID debe ser un UUID v4 válido",
          400
        );
      }

      console.log("[Status] UUID válido, consultando Workflow");

      // 3. Consultar estado del workflow
      try {
        // Intentar obtener el estado del workflow
        // La API de Workflows no tiene un método get() directo para consultar estado
        // Usamos una aproximación basada en verificar si existe en R2
        const resultObject = await env.DIR_API_INMO.get(`dir-api-inmo/${id}.json`);

        if (resultObject) {
          const result = await resultObject.json<{
            executionId: string;
            url: string;
            timestamp: string;
            status: "completed" | "failed" | "running";
            error?: string;
          }>();

          console.log("[Status] Resultado encontrado en R2:", {
            id,
            status: result.status
          });

          return new Response(
            JSON.stringify({
              id: result.executionId,
              status: result.status,
              url: result.url,
              createdAt: result.timestamp,
              updatedAt: result.timestamp,
              error: result.error
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }

        // Si no hay resultado en R2, el workflow podría estar aún en ejecución
        console.log("[Status] Sin resultado en R2 - workflow posiblemente en ejecución");

        return new Response(
          JSON.stringify({
            id: id,
            status: "running",
            url: "unknown",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      } catch (workflowError) {
        console.error("[Status] Error consultando Workflow:", workflowError instanceof Error ? workflowError.message : "Unknown error");

        // Retornar estado por defecto
        return new Response(
          JSON.stringify({
            id: id,
            status: "pending",
            url: "unknown",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          }
        );
      }
    } catch (error) {
      console.error("[Status] Error interno:", error instanceof Error ? error.message : "Unknown error");
      return createErrorResponse(
        "INTERNAL_ERROR",
        "Error interno del servidor",
        "Se produjo un error inesperado. Intente nuevamente más tarde",
        500
      );
    }
  },

  /**
   * Handler para GET /result/:id
   * Recupera el resultado JSON desde R2
   * @param id - UUID de la ejecución
   * @param env - Environment bindings
   * @returns Response HTTP
   */
  async handleResult(id: string, env: Env): Promise<Response> {
    try {
      // 1. Validar formato UUID
      console.log("[Result] Validando UUID para ID:", id);

      if (!isValidUuid(id)) {
        console.log("[Result] UUID inválido:", id);
        return createErrorResponse(
          "BAD_REQUEST",
          "ID de ejecución inválido",
          "El ID debe ser un UUID v4 válido",
          400
        );
      }

      console.log("[Result] UUID válido, buscando en R2");

      // 2. Leer objeto desde R2
      // Path: dir-api-inmo/{id}.json según especificación
      const object = await env.DIR_API_INMO.get(`dir-api-inmo/${id}.json`);

      if (!object) {
        console.log("[Result] Resultado no encontrado en R2:", id);
        return createErrorResponse(
          "NOT_FOUND",
          "Resultado no disponible",
          "El resultado aún no está disponible o la ejecución falló. Consulte el estado en /status/:id",
          404
        );
      }

      const json = await object.json<Record<string, unknown>>();

      console.log("[Result] Resultado encontrado y devuelto:", id);

      return new Response(
        JSON.stringify(json),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      console.error("[Result] Error interno:", error instanceof Error ? error.message : "Unknown error");
      return createErrorResponse(
        "INTERNAL_ERROR",
        "Error interno del servidor",
        "Se produjo un error inesperado. Intente nuevamente más tarde",
        500
      );
    }
  }
};
