# Arquitectura de ApiInmoBase

**Documento:** `docs/ARCHITECTURE.md`  
**Módulo:** ApiInmoBase  
**Versión:** 1.0.0  
**Fecha:** 2026-03-07  
**Estado:** Diseño Sprint 0  

---

## 1. Visión General

ApiInmoBase es el módulo base operativo del proyecto Ulla sobre Cloudflare. Su finalidad es recibir una petición con una dirección web de una ficha de inmueble, iniciar un flujo durable en Cloudflare Workflows, obtener el contenido HTTP de esa página, extraer y estructurar la información a JSON mediante la API de OpenAI, almacenar el resultado en Cloudflare R2 y permitir la consulta posterior del estado o del resultado mediante identificador único.

### 1.1 Alcance

- Procesamiento de una sola dirección web por petición
- Obtención HTTP básica (sin autenticación ni sesión)
- Extracción y estructuración mediante OpenAI
- Almacenamiento en R2 con identificador único
- Consulta de estado/resultado
- Observabilidad básica (logs y trazas)

### 1.2 Recursos Cloudflare Confirmados

| Recurso | Nombre | Tipo | Finalidad |
|---------|--------|------|-----------|
| Worker | `wk-api-inmo` | Cloudflare Workers | Punto de entrada API HTTP |
| Workflow | `wf-api-inmo` | Cloudflare Workflows | Orquestación del flujo durable |
| R2 Bucket | `dir-api-inmo` | Cloudflare R2 | Almacenamiento de resultados JSON |
| KV Namespace | `secrets-api-inmo` | Cloudflare KV | Secrets y claves del proyecto |
| Dominio | `levantecofem.workers.dev` | Cloudflare Workers | Exposición pública del endpoint |

---

## 2. Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE HTTP                                  │
│                         (Navegador / API)                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ POST /scrape
                                    │ Headers: Authorization: Bearer <token>
                                    │ Body: { "url": "https://..." }
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER wk-api-inmo (PÚBLICO)                    │
│                     levantecofem.workers.dev                            │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 1. Validar Token de API                                           │  │
│  │    - Leer header Authorization                                    │  │
│  │    - Consultar KV secrets-api-inmo (clave: TOKEN-API-INMO)        │  │
│  │    - Si inválido → 401 Unauthorized                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 2. Validar Entrada                                                │  │
│  │    - Parsear body JSON                                            │  │
│  │    - Validar campo url (presencia, formato, esquema http/https)   │  │
│  │    - Si inválido → 400 Bad Request                                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 3. Generar UUID v4                                                │  │
│  │    - executionId = crypto.randomUUID()                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 4. Iniciar Workflow                                               │  │
│  │    - WF_API_INMO.create({ url, executionId })                     │  │
│  │    - Retorna instanceId                                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ 5. Devolver Respuesta Inicial                                     │  │
│  │    - Status: 202 Accepted                                         │  │
│  │    - Body: { "id": executionId, "status": "started" }             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ create(instance)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE WORKFLOW wf-api-inmo                       │
│                     (Ejecución Durable)                                 │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ PASO 1: Obtener Contenido HTTP                                    │  │
│  │    - fetch(url)                                                   │  │
│  │    - Validar status 200 OK                                        │  │
│  │    - Extraer HTML/texto                                           │  │
│  │    - Manejo de reintentos                                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ PASO 2: Preparar Contenido para Extracción                        │  │
│  │    - Limitar tamaño si es necesario                               │  │
│  │    - Preparar payload para OpenAI                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ PASO 3: Llamar a API de OpenAI                                    │  │
│  │    - Leer OPENAI_API_KEY desde KV secrets-api-inmo                │  │
│  │    - POST https://api.openai.com/v1/chat/completions              │  │
│  │    - Prompt: extraer datos inmobiliarios                          │  │
│  │    - Manejo de reintentos                                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ PASO 4: Generar JSON Final                                        │  │
│  │    - Estructurar respuesta de OpenAI                              │  │
│  │    - Incluir: executionId, url, timestamp, extractedData          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ PASO 5: Guardar JSON en R2                                        │  │
│  │    - DIR_API_INMO.put(`${executionId}.json`, json)                │  │
│  │    - Bucket: dir-api-inmo                                         │  │
│  │    - Metadatos: executionId, url, timestamp, status               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ PASO 6: Actualizar Estado Final                                   │  │
│  │    - Marcar instancia como "completed"                            │  │
│  │    - Si error → "failed"                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ put(object)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE R2 dir-api-inmo                           │
│                                                                         │
│  Bucket: dir-api-inmo                                                   │
│  Objeto: {executionId}.json                                             │
│  Metadatos:                                                             │
│    - executionId: string (UUID v4)                                      │
│    - url: string (URL original)                                         │
│    - timestamp: string (ISO 8601)                                       │
│    - status: string ("completed" | "failed")                            │
│                                                                         │
│  Ejemplo de clave: "a1b2c3d4-e5f6-7890-abcd-ef1234567890.json"          │
└─────────────────────────────────────────────────────────────────────────┘


                    CONSULTA DE ESTADO Y RESULTADO

┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE HTTP                                  │
└─────────────────────────────────────────────────────────────────────────┘
         │                              │
         │ GET /status/:id              │ GET /result/:id
         │ + Token                      │ + Token
         ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER wk-api-inmo                              │
│                                                                         │
│  GET /status/:id                          GET /result/:id               │
│  ┌─────────────────────────────────┐     ┌───────────────────────────┐  │
│  │ 1. Validar Token                │     │ 1. Validar Token          │  │
│  │ 2. Extraer id de URL            │     │ 2. Extraer id de URL      │  │
│  │ 3. WF_API_INMO.get(id)          │     │ 3. DIR_API_INMO.get(id)   │  │
│  │ 4. Devolver estado              │     │ 4. Leer objeto R2         │  │
│  │    - pending                    │     │ 5. Devolver JSON          │  │
│  │    - running                    │     │                           │  │
│  │    - completed                  │     │                           │  │
│  │    - failed                     │     │                           │  │
│  └─────────────────────────────────┘     └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Descripción de Componentes

### 3.1 Cloudflare Worker (`wk-api-inmo`)

**Responsabilidad:** Punto de entrada público de la API HTTP.

**Ubicación:** `src/index.ts`

**Funciones principales:**

1. **Recepción de peticiones HTTP**
   - Escucha en `levantecofem.workers.dev`
   - Métodos soportados: `POST`, `GET`

2. **Validación de seguridad**
   - Valida token de API en header `Authorization: Bearer <token>`
   - Consulta KV `secrets-api-inmo` (clave: `TOKEN-API-INMO`)
   - Devuelve `401 Unauthorized` si token inválido

3. **Validación de entrada**
   - Parsea body JSON
   - Valida campo `url` (presencia, formato, esquema `http`/`https`)
   - Devuelve `400 Bad Request` si entrada inválida

4. **Generación de identificador único**
   - Genera UUID v4 usando `crypto.randomUUID()`
   - Este UUID será la clave de seguimiento de la ejecución

5. **Inicio de Workflow**
   - Invoca `WF_API_INMO.create({ url, executionId })`
   - Obtiene `instanceId` de la instancia creada

6. **Respuesta inicial asíncrona**
   - Devuelve `202 Accepted`
   - Body: `{ "id": executionId, "status": "started" }`

7. **Consulta de estado**
   - Endpoint `GET /status/:id`
   - Consulta estado de instancia de Workflow
   - Devuelve estado actual

8. **Recuperación de resultado**
   - Endpoint `GET /result/:id`
   - Lee objeto JSON desde R2
   - Devuelve contenido del resultado

**Bindings requeridos:**

| Binding | Tipo | Nombre en Código | Recurso Cloudflare |
|---------|------|------------------|-------------------|
| `WF_API_INMO` | Workflow | `env.WF_API_INMO` | `wf-api-inmo` |
| `DIR_API_INMO` | R2 | `env.DIR_API_INMO` | `dir-api-inmo` |
| `SECRETS_API_INMO` | KV | `env.SECRETS_API_INMO` | `secrets-api-inmo` |

**Endpoints:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/scrape` | Iniciar procesamiento de URL |
| `GET` | `/status/:id` | Consultar estado de ejecución |
| `GET` | `/result/:id` | Recuperar resultado JSON |

---

### 3.2 Cloudflare Workflow (`wf-api-inmo`)

**Responsabilidad:** Motor de ejecución durable del flujo operativo.

**Ubicación:** `src/workflow.ts` (o archivo equivalente)

**Clase base:** `WorkflowEntrypoint`

**Método principal:** `run(event: WorkflowEvent, step: WorkflowStep)`

**Pasos del flujo:**

#### Paso 1: Obtener Contenido HTTP

- **Operación:** `fetch(url)`
- **Validaciones:**
  - Código de estado HTTP 200 OK
  - Timeout configurable (recomendado: 30s)
- **Manejo de errores:**
  - Error de red → reintento
  - Status no 200 → error fatal
- **Reintentos:** 3 intentos con backoff exponencial
- **Salida:** Contenido HTML/texto de la página

#### Paso 2: Preparar Contenido para Extracción

- **Operación:** Procesamiento de contenido
- **Acciones:**
  - Extraer texto/HTML relevante
  - Limitar tamaño si excede límites (recomendado: 100KB)
  - Preparar payload para OpenAI
- **Salida:** Contenido preparado para extracción

#### Paso 3: Llamar a API de OpenAI

- **Operación:** `POST https://api.openai.com/v1/chat/completions`
- **Autenticación:** `OPENAI_API_KEY` desde KV `secrets-api-inmo`
- **Prompt:** Instrucciones para extraer datos inmobiliarios
- **Modelo:** `gpt-4` o `gpt-3.5-turbo` (configurable)
- **Manejo de errores:**
  - Timeout → reintento
  - Rate limit → reintento con delay
  - Error de autenticación → error fatal
- **Reintentos:** 3 intentos con backoff exponencial
- **Salida:** Respuesta estructurada de OpenAI

#### Paso 4: Generar JSON Final

- **Operación:** Estructuración de datos
- **Campos obligatorios:**
  - `executionId`: UUID v4
  - `url`: URL original procesada
  - `timestamp`: Fecha/hora ISO 8601
  - `extractedData`: Datos extraídos por OpenAI
- **Salida:** Objeto JSON completo

#### Paso 5: Guardar JSON en R2

- **Operación:** `DIR_API_INMO.put(key, value, options)`
- **Clave:** `{executionId}.json`
- **Metadatos:**
  - `executionId`: string
  - `url`: string
  - `timestamp`: string
  - `status`: "completed" | "failed"
- **Manejo de errores:**
  - Error de escritura → reintento
  - Bucket no encontrado → error fatal
- **Reintentos:** 3 intentos con backoff exponencial
- **Salida:** Confirmación de escritura

#### Paso 6: Actualizar Estado Final

- **Operación:** Finalización de instancia
- **Estados posibles:**
  - `completed`: Éxito total
  - `failed`: Error en algún paso
- **Salida:** Instancia marcada como finalizada

**Estados del Workflow:**

| Estado | Descripción |
|--------|-------------|
| `pending` | Workflow no iniciado |
| `running` | Workflow en ejecución |
| `completed` | Workflow completado exitosamente |
| `failed` | Workflow falló por error |

---

### 3.3 Cloudflare R2 (`dir-api-inmo`)

**Responsabilidad:** Almacenamiento persistente de resultados JSON.

**Tipo:** Bucket de objetos

**Estructura de almacenamiento:**

- **Bucket:** `dir-api-inmo`
- **Clave de objeto:** `{executionId}.json`
- **Formato de clave:** UUID v4 + extensión `.json`
- **Ejemplo:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890.json`

**Estructura del objeto JSON:**

```json
{
  "executionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "https://example.com/inmueble/123",
  "timestamp": "2026-03-07T10:30:00.000Z",
  "status": "completed",
  "extractedData": {
    "tipo": "piso",
    "operacion": "venta",
    "precio": 250000,
    "habitaciones": 3,
    "banos": 2,
    "metrosCuadrados": 95,
    "direccion": "Calle Ejemplo 123, Madrid",
    "descripcion": "Piso luminoso con...",
    "caracteristicas": ["ascensor", "calefaccion", "aire acondicionado"],
    "imagenes": ["https://...", "https://..."]
  }
}
```

**Metadatos del objeto R2:**

| Metadato | Tipo | Descripción |
|----------|------|-------------|
| `executionId` | string | UUID v4 de la ejecución |
| `url` | string | URL original procesada |
| `timestamp` | string | Fecha/hora ISO 8601 |
| `status` | string | Estado final ("completed" | "failed") |

**Política de conservación:**

- **Actual:** Conservación indefinida
- **Futuro:** Política de borrado configurable (pendiente)

---

### 3.4 Cloudflare KV (`secrets-api-inmo`)

**Responsabilidad:** Almacenamiento seguro de secrets y claves.

**Tipo:** KV Namespace

**Claves almacenadas:**

| Clave | Descripción | Uso |
|-------|-------------|-----|
| `TOKEN-API-INMO` | Token de validación de API | Validar consumo de endpoints |
| `OPENAI_API_KEY` | Clave de API de OpenAI | Autenticar llamadas a OpenAI |

**Acceso desde código:**

```typescript
// Leer token de API
const token = await env.SECRETS_API_INMO.get("TOKEN-API-INMO");

// Leer clave de OpenAI
const openaiKey = await env.SECRETS_API_INMO.get("OPENAI_API_KEY");
```

**Consideraciones de seguridad:**

- Los valores NO deben exponerse en logs
- Los valores NO deben hardcodearse en el código
- El acceso es solo desde Workers con binding configurado

---

## 4. Interacciones entre Componentes

### 4.1 Flujo de Inicio de Procesamiento

```
Cliente → Worker → KV (validar token) → Worker → Workflow → R2
```

**Secuencia detallada:**

1. Cliente envía `POST /scrape` con token y URL
2. Worker consulta KV `secrets-api-inmo` para validar token
3. Worker valida entrada (URL)
4. Worker genera UUID v4
5. Worker inicia Workflow mediante binding `WF_API_INMO`
6. Worker devuelve `202 Accepted` con executionId
7. Workflow ejecuta pasos 1-6
8. Workflow guarda resultado en R2 mediante binding `DIR_API_INMO`

### 4.2 Flujo de Consulta de Estado

```
Cliente → Worker → Workflow (consultar estado) → Worker → Cliente
```

**Secuencia detallada:**

1. Cliente envía `GET /status/:id` con token
2. Worker valida token
3. Worker consulta estado de instancia mediante binding `WF_API_INMO`
4. Worker devuelve estado actual

### 4.3 Flujo de Recuperación de Resultado

```
Cliente → Worker → R2 (leer objeto) → Worker → Cliente
```

**Secuencia detallada:**

1. Cliente envía `GET /result/:id` con token
2. Worker valida token
3. Worker lee objeto JSON desde R2 mediante binding `DIR_API_INMO`
4. Worker devuelve contenido del JSON

---

## 5. Bindings Requeridos

### 5.1 Resumen de Bindings

| Binding | Tipo | Nombre en Código | Recurso Cloudflare | Descripción |
|---------|------|------------------|-------------------|-------------|
| `WF_API_INMO` | Workflow | `env.WF_API_INMO` | `wf-api-inmo` | Acceso a instancia de Workflow |
| `DIR_API_INMO` | R2 | `env.DIR_API_INMO` | `dir-api-inmo` | Acceso a bucket R2 |
| `SECRETS_API_INMO` | KV | `env.SECRETS_API_INMO` | `secrets-api-inmo` | Acceso a secrets |

### 5.2 Configuración en `wrangler.toml`

```toml
name = "wk-api-inmo"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Bindings
[[workflows]]
name = "wf-api-inmo"
binding = "WF_API_INMO"

[[r2_buckets]]
bucket_name = "dir-api-inmo"
binding = "DIR_API_INMO"

[[kv_namespaces]]
namespace_id = "<SECRETS_API_INMO_NAMESPACE_ID>"
binding = "SECRETS_API_INMO"

# Variables de entorno
[env.dev.vars]
ENVIRONMENT = "dev"

[env.production]
name = "wk-api-inmo-production"

[env.production.vars]
ENVIRONMENT = "production"
```

### 5.3 Uso en Código

```typescript
// src/index.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Acceder a Workflow
    const workflow = env.WF_API_INMO;
    const instance = await workflow.create({ url: "https://...", executionId: "..." });
    
    // Acceder a R2
    const r2 = env.DIR_API_INMO;
    await r2.put("key.json", JSON.stringify(data));
    const object = await r2.get("key.json");
    
    // Acceder a KV
    const kv = env.SECRETS_API_INMO;
    const token = await kv.get("TOKEN-API-INMO");
    const openaiKey = await kv.get("OPENAI_API_KEY");
  }
};
```

---

## 6. Consideraciones de Diseño

### 6.1 Principios de Diseño

1. **Simplicidad:** Cada componente tiene una responsabilidad única
2. **Ampliabilidad:** Puntos de extensión claros para funcionalidad futura
3. **Resiliencia:** Reintentos automáticos en pasos críticos
4. **Observabilidad:** Logs y trazas en todos los componentes
5. **Seguridad:** Secrets en KV, nunca en código

### 6.2 Límites Técnicos

| Límite | Valor | Nota |
|--------|-------|------|
| Timeout de Worker (request) | 30s (dev), 60s (prod) | Cloudflare Workers |
| Timeout de Workflow step | 10 min | Cloudflare Workflows |
| Tamaño máximo de R2 object | 5 TB | Cloudflare R2 |
| Tamaño máximo de KV value | 25 MB | Cloudflare KV |
| CPU time de Worker | 10 ms (dev), 50 ms (prod) | Cloudflare Workers |

### 6.3 Estrategia de Reintentos

**Workflow Steps:**

```typescript
step.do("nombre", {
  retries: {
    limit: 3,
    delay: "10s",
    backoff: "exponential"
  }
}, async () => {
  // Operación con reintento
});
```

### 6.4 Estrategia de Logs

**Niveles de log:**

- `info`: Operaciones normales
- `warn`: Advertencias no bloqueantes
- `error`: Errores que requieren atención

**Campos obligatorios:**

- `executionId`: UUID de la ejecución
- `timestamp`: Fecha/hora ISO 8601
- `level`: Nivel de log
- `message`: Mensaje descriptivo
- `step`: Paso del workflow (cuando aplique)

---

## 7. Decisiones Técnicas

### 7.1 Identificador Único

**Decisión:** UUID v4 generado con `crypto.randomUUID()`

**Razones:**
- Estándar ampliamente adoptado
- Baja probabilidad de colisión
- Generación eficiente en edge
- Soporte nativo en Cloudflare Workers

### 7.2 Formato de Clave R2

**Decisión:** `{executionId}.json`

**Razones:**
- Simple y directo
- Fácil de consultar
- Evita colisiones
- Permite listado por prefijo si se requiere en futuro

### 7.3 Respuesta Asíncrona

**Decisión:** `202 Accepted` con executionId

**Razones:**
- El procesamiento puede tardar más que el timeout del Worker
- El cliente puede consultar estado posteriormente
- Patrón estándar para operaciones de larga duración

### 7.4 Validación de Token

**Decisión:** Header `Authorization: Bearer <token>`

**Razones:**
- Estándar HTTP
- Fácil de implementar
- Compatible con herramientas existentes
- Token almacenado en KV para rotación segura

---

## 8. Puntos de Ampliación Futura

### 8.1 Autenticación y Autorización

- Sistema de usuarios
- Roles y permisos
- API keys por cliente
- Rate limiting por cliente

### 8.2 Multiportal Avanzado

- Configuración por portal inmobiliario
- Selectores CSS personalizados por portal
- Plantillas de extracción específicas

### 8.3 Procesamiento de Múltiples URLs

- Batch de URLs por petición
- Cola de procesamiento
- Notificaciones de completado

### 8.4 Enriquecimiento de Datos

- Validación de datos extraídos
- Normalización de formatos
- Clasificación automática
- Detección de duplicados

### 8.5 Política de Conservación

- TTL configurable por objeto
- Borrado automático
- Archivado en frío

---

## 9. Referencias

- [Cloudflare Workflows Overview](https://developers.cloudflare.com/workflows/)
- [Cloudflare Workflows Workers API](https://developers.cloudflare.com/workflows/build/workers-api/)
- [Cloudflare R2 Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [Cloudflare Workers Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
- [Cloudflare KV Namespace](https://developers.cloudflare.com/kv/)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Cloudflare Workers Traces](https://developers.cloudflare.com/workers/observability/traces/)

---

**FIN DEL DOCUMENTO DE ARQUITECTURA**
