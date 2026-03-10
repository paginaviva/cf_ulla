# Especificación de Seguridad - ApiInmoBase

**Documento:** `docs/SECURITY.md`  
**Módulo:** ApiInmoBase  
**Versión:** 1.0.0  
**Fecha:** 2026-03-07  
**Estado:** Diseño Sprint 0  

---

## 1. Visión General

Este documento especifica los mecanismos de seguridad implementados en ApiInmoBase para proteger el acceso a la API, garantizar la confidencialidad de las credenciales y asegurar la integridad de las operaciones.

### 1.1 Principios de Seguridad

1. **Mínimo privilegio:** Solo las operaciones necesarias están permitidas
2. **Defensa en profundidad:** Múltiples capas de validación
3. **Secrets nunca en código:** Todas las credenciales en KV
4. **Validación temprana:** Rechazar requests inválidos lo antes posible
5. **Logs sin datos sensibles:** No exponer información confidencial en logs

---

## 2. Autenticación de API

### 2.1 Mecanismo de Autenticación

**Tipo:** Bearer Token

**Ubicación:** Header HTTP `Authorization`

**Formato:**
```
Authorization: Bearer <token>
```

### 2.2 Flujo de Validación de Token

```
┌─────────────────────────────────────────────────────────────────┐
│                    PETICIÓN HTTP ENTRANTE                       │
│              Authorization: Bearer <token>                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              WORKER wk-api-inmo (Punto de Entrada)              │
│                                                                 │
│  1. Extraer token del header Authorization                      │
│     - Parsear header: "Bearer <token>"                          │
│     - Extraer valor después de "Bearer "                        │
│                                                                 │
│  2. Consultar KV secrets-api-inmo                               │
│     - Clave: TOKEN-API-INMO                                     │
│     - Método: await env.SECRETS_API_INMO.get("TOKEN-API-INMO")  │
│                                                                 │
│  3. Comparar tokens                                             │
│     - Token proporcionado vs Token almacenado                   │
│     - Comparación constante (timing-safe)                       │
│                                                                 │
│  4. Decisión                                                    │
│     - Si coinciden → Continuar con procesamiento                │
│     - Si NO coinciden → Devolver 401 Unauthorized               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Token Válido    │ → Continuar procesamiento
                    └─────────────────┘
                              │
                    ┌─────────────────┐
                    │ Token Inválido  │ → 401 Unauthorized
                    └─────────────────┘
```

### 2.3 Implementación de Validación

```typescript
// src/utils/auth.ts

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
  // 1. Extraer header Authorization
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    return false;
  }
  
  // 2. Parsear token del formato "Bearer <token>"
  const parts = authHeader.split(" ");
  
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return false;
  }
  
  const providedToken = parts[1];
  
  if (!providedToken) {
    return false;
  }
  
  // 3. Leer token almacenado desde KV
  const storedToken = await env.SECRETS_API_INMO.get("TOKEN-API-INMO");
  
  if (!storedToken) {
    // Token no configurado en KV - error de configuración
    console.error("TOKEN-API-INMO no configurado en KV");
    return false;
  }
  
  // 4. Comparar tokens (comparación constante)
  // Nota: En producción, usar comparación constante para evitar timing attacks
  return providedToken === storedToken;
}

/**
 * Handler de error de autenticación
 * @returns Response 401 Unauthorized
 */
function createUnauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: "UNAUTHORIZED",
        message: "Token de API inválido o no proporcionado",
        details: "El header Authorization debe contener un token válido"
      }
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
```

### 2.4 Respuesta de Autenticación Fallida

**Código HTTP:** `401 Unauthorized`

**Headers:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json
WWW-Authenticate: Bearer
```

**Body:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token de API inválido o no proporcionado",
    "details": "El header Authorization debe contener un token válido"
  }
}
```

### 2.5 Casos de Error de Autenticación

| Caso | Descripción | Acción |
|------|-------------|--------|
| Header faltante | No hay header `Authorization` | 401 Unauthorized |
| Formato inválido | No sigue patrón `Bearer <token>` | 401 Unauthorized |
| Token vacío | Token es string vacío | 401 Unauthorized |
| Token no coincide | Token diferente al almacenado en KV | 401 Unauthorized |
| KV inaccesible | Error al leer desde KV | 500 Internal Server Error |

---

## 3. Almacenamiento de Secrets en KV

### 3.1 KV Namespace Configurado

| Propiedad | Valor |
|-----------|-------|
| **Nombre** | `secrets-api-inmo` |
| **Tipo** | KV Namespace |
| **Binding** | `SECRETS_API_INMO` |
| **Estado** | ✅ Creado |

### 3.2 Secrets Almacenados

| Clave | Descripción | Uso | Sensibilidad |
|-------|-------------|-----|--------------|
| `TOKEN-API-INMO` | Token de autenticación de API | Validar acceso a endpoints | Alta |
| `OPENAI_API_KEY` | Clave de API de OpenAI | Autenticar llamadas a OpenAI | Crítica |

### 3.3 Configuración de Secrets

#### 3.3.1 TOKEN-API-INMO

**Propósito:** Validar el consumo de la API del Worker `wk-api-inmo`.

**Formato recomendado:** UUID v4 o string aleatorio de 32+ caracteres

**Generación sugerida:**
```bash
# Generar UUID v4
node -e "console.log(require('crypto').randomUUID())"

# O generar string aleatorio
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Rotación:** 
- Frecuencia recomendada: Cada 90 días
- Procedimiento:
  1. Generar nuevo token
  2. Actualizar en KV `secrets-api-inmo`
  3. Distribuir nuevo token a clientes autorizados
  4. Invalidar token anterior (opcional, con ventana de gracia)

#### 3.3.2 OPENAI_API_KEY

**Propósito:** Autenticar llamadas a la API de OpenAI para extracción de datos.

**Formato:** String proporcionado por OpenAI (ej. `sk-...`)

**Obtención:** [OpenAI Platform](https://platform.openai.com/api-keys)

**Rotación:**
- Frecuencia recomendada: Cada 60 días o ante sospecha de compromiso
- Procedimiento:
  1. Generar nueva key en OpenAI Platform
  2. Actualizar en KV `secrets-api-inmo`
  3. Eliminar key anterior en OpenAI Platform

### 3.4 Acceso desde Código

```typescript
// src/index.ts o archivo equivalente

// Leer TOKEN-API-INMO
const apiToken = await env.SECRETS_API_INMO.get("TOKEN-API-INMO");

// Leer OPENAI_API_KEY
const openaiKey = await env.SECRETS_API_INMO.get("OPENAI_API_KEY");

// Validar que existen
if (!apiToken || !openaiKey) {
  throw new Error("Secrets no configurados correctamente");
}
```

### 3.5 Consideraciones de Seguridad

#### 3.5.1 Nunca Hardcodear Secrets

**INCORRECTO:**
```typescript
// ❌ NUNCA HACER ESTO
const OPENAI_KEY = "sk-abc123...";
const API_TOKEN = "mi-token-secreto";
```

**CORRECTO:**
```typescript
// ✅ SIEMPRE LEER DESDE KV
const openaiKey = await env.SECRETS_API_INMO.get("OPENAI_API_KEY");
const apiToken = await env.SECRETS_API_INMO.get("TOKEN-API-INMO");
```

#### 3.5.2 No Exponer en Logs

**INCORRECTO:**
```typescript
// ❌ NUNCA LOGUEAR SECRETS
console.log("Token:", apiToken);
console.log("OpenAI Key:", openaiKey);
```

**CORRECTO:**
```typescript
// ✅ LOGUEAR SOLO ESTADO, NO VALORES
console.log("Token validado:", tokenValido);
console.log("OpenAI key configurada:", !!openaiKey);
```

#### 3.5.3 No Exponer en Respuestas

**INCORRECTO:**
```typescript
// ❌ NUNCA DEVOLVER SECRETS EN RESPUESTAS
return json({ token: apiToken, data: result });
```

**CORRECTO:**
```typescript
// ✅ DEVOLVER SOLO DATOS NO SENSIBLES
return json({ id: executionId, status: "started" });
```

---

## 4. CORS (Cross-Origin Resource Sharing)

### 4.1 Configuración Actual

**Estado:** Configurado automáticamente por `cloudflare-wrangler`

**Comportamiento por defecto:** Permite todos los orígenes (`*`)

### 4.2 Configuración Pendiente

Los siguientes aspectos están pendientes de confirmación por el usuario:

| Configuración | Estado | Valor Pendiente |
|---------------|--------|-----------------|
| Orígenes permitidos | ⏳ Pendiente | ¿Solo localhost? ¿Dominios específicos? |
| Métodos permitidos | ⏳ Pendiente | GET, POST, OPTIONS (recomendado) |
| Headers permitidos | ⏳ Pendiente | Content-Type, Authorization (recomendado) |
| Credenciales | ⏳ Pendiente | ¿Permitir cookies/credenciales? |

### 4.3 Configuración Recomendada para Desarrollo

```typescript
// src/index.ts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Cambiar en producción
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Manejar preflight requests
if (request.method === "OPTIONS") {
  return new Response(null, {
    headers: corsHeaders,
    status: 204, // No Content
  });
}
```

### 4.4 Configuración Recomendada para Producción

```typescript
// Lista blanca de orígenes permitidos
const allowedOrigins = [
  "https://mi-app.com",
  "https://admin.mi-app.com",
];

function getCorsHeaders(origin: string | null) {
  const allowOrigin = origin && allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0]; // O retornar null para rechazar
  
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
```

### 4.5 Request Preflight

**Método:** `OPTIONS`

**Headers del cliente:**
```http
OPTIONS /scrape HTTP/1.1
Host: levantecofem.workers.dev
Origin: https://mi-app.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

**Respuesta del servidor:**
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://mi-app.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

---

## 5. Validación de Entrada

### 5.1 Principios de Validación

1. **Validar temprano:** Rechazar entrada inválida lo antes posible
2. **Validar todo:** Nunca confiar en la entrada del cliente
3. **Mensajes claros:** Informar qué está mal sin exponer detalles internos
4. **Fail closed:** En caso de duda, rechazar la entrada

### 5.2 Validación del Endpoint POST /scrape

#### 5.2.1 Validación de Content-Type

**Requerimiento:** `Content-Type: application/json`

**Implementación:**
```typescript
const contentType = request.headers.get("Content-Type");

if (!contentType || !contentType.includes("application/json")) {
  return new Response(
    JSON.stringify({
      error: {
        code: "BAD_REQUEST",
        message: "Content-Type inválido",
        details: "El Content-Type debe ser application/json"
      }
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}
```

#### 5.2.2 Validación de Body JSON

**Requerimiento:** Body debe ser JSON válido

**Implementación:**
```typescript
let body: { url?: string };

try {
  body = await request.json();
} catch (error) {
  return new Response(
    JSON.stringify({
      error: {
        code: "BAD_REQUEST",
        message: "Body JSON inválido",
        details: "El body debe ser un JSON válido"
      }
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}
```

#### 5.2.3 Validación de Campo URL

**Requerimientos:**
1. Presencia obligatoria
2. Tipo string
3. Formato de URL válido (RFC 3986)
4. Esquema `http` o `https`

**Implementación:**
```typescript
// Validar presencia
if (!body.url) {
  return new Response(
    JSON.stringify({
      error: {
        code: "BAD_REQUEST",
        message: "Entrada inválida",
        details: ["El campo 'url' es requerido"]
      }
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}

// Validar tipo
if (typeof body.url !== "string") {
  return new Response(
    JSON.stringify({
      error: {
        code: "BAD_REQUEST",
        message: "Entrada inválida",
        details: ["El campo 'url' debe ser una cadena de texto"]
      }
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}

// Validar formato de URL
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

if (!isValidUrl(body.url)) {
  return new Response(
    JSON.stringify({
      error: {
        code: "BAD_REQUEST",
        message: "Entrada inválida",
        details: ["El campo 'url' debe ser una URL válida con esquema http o https"]
      }
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}
```

### 5.3 Validación del Endpoint GET /status/:id

#### 5.3.1 Validación de UUID

**Requerimiento:** ID debe ser UUID v4 válido

**Patrón:** `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`

**Implementación:**
```typescript
function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// En el handler
const url = new URL(request.url);
const pathParts = url.pathname.split("/");
const id = pathParts[pathParts.length - 1];

if (!isValidUuid(id)) {
  return new Response(
    JSON.stringify({
      error: {
        code: "BAD_REQUEST",
        message: "ID de ejecución inválido",
        details: "El ID debe ser un UUID v4 válido"
      }
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}
```

---

## 6. Manejo Seguro de Errores

### 6.1 Principios

1. **No exponer detalles internos:** Los errores no deben revelar implementación
2. **Loguear internamente:** Registrar detalles completos para debugging
3. **Respuestas genéricas:** Devolver mensajes seguros al cliente
4. **Consistencia:** Mismo formato para todos los errores

### 6.2 Ejemplo de Manejo de Errores

```typescript
// src/index.ts

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      // Validar token
      const tokenValid = await validateApiToken(request, env);
      
      if (!tokenValid) {
        // Log interno (no expone detalles al cliente)
        console.log("Intento de acceso con token inválido");
        return createUnauthorizedResponse();
      }
      
      // Procesar request...
      
    } catch (error) {
      // Log interno con detalles completos
      console.error("Error interno:", error);
      
      // Respuesta genérica al cliente
      return new Response(
        JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "Error interno del servidor",
            details: "Se produjo un error inesperado. Intente nuevamente más tarde"
          }
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
};
```

### 6.3 Categorías de Error

| Categoría | Código HTTP | Información al Cliente | Información en Logs |
|-----------|-------------|------------------------|---------------------|
| Autenticación | 401 | Token inválido | Token proporcionado (hash), IP, timestamp |
| Validación | 400 | Campo inválido | Campo, valor, razón del rechazo |
| No Encontrado | 404 | Recurso no existe | ID buscado, endpoint |
| Interno | 500 | Error genérico | Stack trace completo, contexto |

---

## 7. Seguridad en Logs

### 7.1 Información que NO debe loguearse

- ❌ Tokens de API
- ❌ Claves de OpenAI
- ❌ Credenciales de cualquier tipo
- ❌ URLs completas con parámetros sensibles
- ❌ Bodies de request con datos personales

### 7.2 Información segura para loguear

- ✅ ExecutionId (UUID)
- ✅ Estado de validación (true/false)
- ✅ Timestamps
- ✅ Códigos de error
- ✅ Estados del workflow
- ✅ URLs sin parámetros query sensibles

### 7.3 Ejemplo de Logging Seguro

```typescript
// ❌ INCORRECTO - Expone datos sensibles
console.log("Token recibido:", authHeader);
console.log("URL a procesar:", body.url);
console.log("OpenAI Key:", openaiKey);

// ✅ CORRECTO - Solo información necesaria
console.log("Request recibida:", {
  method: request.method,
  path: url.pathname,
  hasAuth: !!authHeader,
  tokenValid: tokenValido,
  executionId: executionId
});

console.log("Procesamiento iniciado:", {
  executionId: executionId,
  urlDomain: new URL(body.url).hostname, // Solo dominio, no URL completa
  timestamp: new Date().toISOString()
});
```

---

## 8. Consideraciones de Seguridad en Workflow

### 8.1 Acceso a Secrets desde Workflow

```typescript
// src/workflow.ts

export class ApiInmoWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Leer secret desde KV dentro del workflow
    const openaiKey = await this.env.SECRETS_API_INMO.get("OPENAI_API_KEY");
    
    // Usar para llamada a API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [...]
      })
    });
  }
}
```

### 8.2 Manejo de Errores de API Externa

```typescript
// Reintentos con backoff exponencial
await step.do("Llamar a OpenAI", {
  retries: {
    limit: 3,
    delay: "10s",
    backoff: "exponential"
  }
}, async () => {
  const response = await fetch(openaiUrl, options);
  
  if (!response.ok) {
    if (response.status === 429) {
      // Rate limit - reintento automático
      throw new Error(`OpenAI rate limit: ${response.status}`);
    }
    
    if (response.status === 401) {
      // Error de autenticación - NO reintentar
      throw new Error(`OpenAI auth error: ${response.status}`);
    }
    
    // Otros errores - reintentar
    throw new Error(`OpenAI error: ${response.status}`);
  }
  
  return response.json();
});
```

---

## 9. Checklist de Seguridad

### 9.1 Pre-Despliegue

- [ ] `TOKEN-API-INMO` configurado en KV `secrets-api-inmo`
- [ ] `OPENAI_API_KEY` configurado en KV `secrets-api-inmo`
- [ ] Binding `SECRETS_API_INMO` configurado en `wrangler.toml`
- [ ] Validación de token implementada en todos los endpoints
- [ ] Validación de entrada implementada
- [ ] Manejo de errores seguro (sin exposición de detalles)
- [ ] Logs sin datos sensibles
- [ ] CORS configurado apropiadamente

### 9.2 Post-Despliegue

- [ ] Verificar que endpoints sin token devuelven 401
- [ ] Verificar que endpoints con token inválido devuelven 401
- [ ] Verificar que endpoints con token válido funcionan
- [ ] Verificar que logs no exponen secrets en Cloudflare Dashboard
- [ ] Verificar que errores no exponen stack traces al cliente

### 9.3 Mantenimiento Continuo

- [ ] Rotar `TOKEN-API-INMO` cada 90 días
- [ ] Rotar `OPENAI_API_KEY` cada 60 días
- [ ] Revisar logs buscando patrones sospechosos
- [ ] Actualizar lista de orígenes CORS según sea necesario
- [ ] Revisar y actualizar políticas de rate limiting (futuro)

---

## 10. Referencias

- [Cloudflare Workers Security Best Practices](https://developers.cloudflare.com/workers/best-practices/security/)
- [Cloudflare KV Security](https://developers.cloudflare.com/kv/concepts/security/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [RFC 6750 - The OAuth 2.0 Authorization Framework: Bearer Token Usage](https://tools.ietf.org/html/rfc6750)

---

**FIN DE LA ESPECIFICACIÓN DE SEGURIDAD**
