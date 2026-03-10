# Contrato de API - ApiInmoBase

**Documento:** `docs/API_CONTRACT.md`  
**Módulo:** ApiInmoBase  
**Versión:** 1.0.0  
**Fecha:** 2026-03-07  
**Estado:** Diseño Sprint 0  

---

## 1. Visión General

Este documento especifica el contrato completo de la API HTTP de ApiInmoBase. Define los endpoints, métodos, payloads de entrada/salida, códigos de estado HTTP y formato de errores.

### 1.1 Información Base

| Elemento | Valor |
|----------|-------|
| **Dominio de desarrollo** | `https://levantecofem.workers.dev` |
| **Dominio de producción** | `https://levantecofem.workers.dev` |
| **Formato de datos** | JSON (`application/json`) |
| **Codificación** | UTF-8 |
| **Autenticación** | Bearer Token en header `Authorization` |

### 1.2 Endpoints Disponibles

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `POST` | `/scrape` | Iniciar procesamiento de URL | Requerida |
| `GET` | `/status/:id` | Consultar estado de ejecución | Requerida |
| `GET` | `/result/:id` | Recuperar resultado JSON | Requerida |

---

## 2. Endpoint: POST /scrape

### 2.1 Descripción

Inicia el procesamiento de una dirección web de ficha inmobiliaria. Este endpoint es asíncrono: no devuelve el resultado completo, sino que confirma el inicio del procesamiento y proporciona un identificador único para consultas posteriores.

### 2.2 Request

#### Headers

| Header | Requerido | Valor | Descripción |
|--------|-----------|-------|-------------|
| `Content-Type` | Sí | `application/json` | Tipo de contenido del body |
| `Authorization` | Sí | `Bearer <token>` | Token de autenticación de API |

#### Body

**Tipo:** JSON object

**Schema:**

```json
{
  "url": "string (required)"
}
```

**Campos:**

| Campo | Tipo | Requerido | Validación | Descripción |
|-------|------|-----------|------------|-------------|
| `url` | string | Sí | - Presencia obligatoria<br>- Formato URL válido<br>- Esquema `http` o `https` | Dirección web de la ficha inmobiliaria a procesar |

#### Ejemplo de Request

```http
POST /scrape HTTP/1.1
Host: levantecofem.workers.dev
Content-Type: application/json
Authorization: Bearer mi-token-secreto

{
  "url": "https://www.idealista.com/inmueble/12345678/"
}
```

### 2.3 Validaciones

#### 2.3.1 Validación de Token

**Ubicación:** Header `Authorization`

**Formato:** `Bearer <token>`

**Proceso:**
1. Extraer token del header
2. Consultar KV `secrets-api-inmo` (clave: `TOKEN-API-INMO`)
3. Comparar token proporcionado con token almacenado
4. Si no coincide → `401 Unauthorized`

**Error por token inválido:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token de API inválido o no proporcionado",
    "details": "El header Authorization debe contener un token válido"
  }
}
```

#### 2.3.2 Validación de Entrada

**Campo `url`:**

1. **Presencia:** El campo debe existir en el body
2. **Tipo:** Debe ser string
3. **Formato:** Debe ser una URL válida según RFC 3986
4. **Esquema:** Debe comenzar con `http://` o `https://`

**Errores por entrada inválida:**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Entrada inválida",
    "details": [
      "El campo 'url' es requerido"
    ]
  }
}
```

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Entrada inválida",
    "details": [
      "El campo 'url' debe ser una URL válida con esquema http o https"
    ]
  }
}
```

### 2.4 Response

#### 2.4.1 Respuesta Exitosa (202 Accepted)

**Código:** `202 Accepted`

**Headers:**

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |

**Body:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "started",
  "message": "Procesamiento iniciado correctamente"
}
```

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | UUID v4 identificador de la ejecución |
| `status` | string | Estado inicial: `"started"` |
| `message` | string | Mensaje de confirmación |

#### 2.4.2 Ejemplo de Response Exitosa

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "started",
  "message": "Procesamiento iniciado correctamente"
}
```

---

## 3. Endpoint: GET /status/:id

### 3.1 Descripción

Consulta el estado actual de una ejecución de procesamiento identificada por su UUID.

### 3.2 Request

#### Headers

| Header | Requerido | Valor | Descripción |
|--------|-----------|-------|-------------|
| `Authorization` | Sí | `Bearer <token>` | Token de autenticación de API |

#### Path Parameters

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `id` | string (UUID) | Sí | UUID de la ejecución a consultar |

#### Ejemplo de Request

```http
GET /status/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: levantecofem.workers.dev
Authorization: Bearer mi-token-secreto
```

### 3.3 Validaciones

#### 3.3.1 Validación de Token

Mismo proceso que `POST /scrape`.

#### 3.3.2 Validación de UUID

**Formato:** UUID v4 válido

**Patrón:** `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`

**Error por UUID inválido:**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "ID de ejecución inválido",
    "details": "El ID debe ser un UUID v4 válido"
  }
}
```

### 3.4 Response

#### 3.4.1 Respuesta Exitosa (200 OK)

**Código:** `200 OK`

**Body:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "running",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "createdAt": "2026-03-07T10:30:00.000Z",
  "updatedAt": "2026-03-07T10:30:15.000Z"
}
```

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | UUID de la ejecución |
| `status` | string | Estado actual (ver tabla de estados) |
| `url` | string | URL original procesada |
| `createdAt` | string | Fecha/hora de inicio (ISO 8601) |
| `updatedAt` | string | Fecha/hora de última actualización (ISO 8601) |

#### 3.4.2 Estados Posibles

| Estado | Descripción | Cuándo se usa |
|--------|-------------|---------------|
| `pending` | Workflow no iniciado | Instancia creada pero no comenzada |
| `running` | Workflow en ejecución | Procesamiento en curso |
| `completed` | Workflow completado | Procesamiento exitoso finalizado |
| `failed` | Workflow fallido | Error durante el procesamiento |

#### 3.4.3 Ejemplo de Response por Estado

**Estado: `running`**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "running",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "createdAt": "2026-03-07T10:30:00.000Z",
  "updatedAt": "2026-03-07T10:30:15.000Z"
}
```

**Estado: `completed`**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "createdAt": "2026-03-07T10:30:00.000Z",
  "updatedAt": "2026-03-07T10:32:00.000Z"
}
```

**Estado: `failed`**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "failed",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "createdAt": "2026-03-07T10:30:00.000Z",
  "updatedAt": "2026-03-07T10:31:00.000Z",
  "error": "Error al obtener contenido HTTP: timeout"
}
```

#### 3.4.4 Instancia No Encontrada (404 Not Found)

**Código:** `404 Not Found`

**Body:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ejecución no encontrada",
    "details": "No existe ninguna ejecución con el ID proporcionado"
  }
}
```

---

## 4. Endpoint: GET /result/:id

### 4.1 Descripción

Recupera el resultado JSON completo de una ejecución de procesamiento. El resultado solo está disponible cuando el estado es `completed`.

### 4.2 Request

#### Headers

| Header | Requerido | Valor | Descripción |
|--------|-----------|-------|-------------|
| `Authorization` | Sí | `Bearer <token>` | Token de autenticación de API |

#### Path Parameters

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `id` | string (UUID) | Sí | UUID de la ejecución |

#### Ejemplo de Request

```http
GET /result/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: levantecofem.workers.dev
Authorization: Bearer mi-token-secreto
```

### 4.3 Validaciones

#### 4.3.1 Validación de Token

Mismo proceso que `POST /scrape`.

#### 4.3.2 Validación de UUID

Mismo proceso que `GET /status/:id`.

#### 4.3.3 Verificación de Existencia

- Verifica que el objeto JSON existe en R2
- Si no existe → `404 Not Found`

### 4.4 Response

#### 4.4.1 Respuesta Exitosa (200 OK)

**Código:** `200 OK`

**Headers:**

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/json` |

**Body:**

```json
{
  "executionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "timestamp": "2026-03-07T10:32:00.000Z",
  "status": "completed",
  "extractedData": {
    "tipo": "piso",
    "operacion": "venta",
    "precio": 250000,
    "moneda": "EUR",
    "habitaciones": 3,
    "banos": 2,
    "metrosCuadrados": 95,
    "planta": "3",
    "direccion": "Calle Ejemplo 123, Madrid",
    "codigoPostal": "28001",
    "descripcion": "Piso luminoso y exterior en pleno centro de Madrid. Completamente reformado, cuenta con 3 habitaciones dobles, 2 baños completos, cocina equipada y salón-comedor con balcón. Edificio con ascensor y portal vigilado. Ideal para familias.",
    "caracteristicas": [
      "ascensor",
      "calefaccion",
      "aire acondicionado",
      "balcon",
      "reformado",
      "exterior"
    ],
    "imagenes": [
      "https://img.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/12/34/56/123456789.jpg",
      "https://img.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/12/34/56/123456790.jpg"
    ],
    "energiaCertificacion": "E",
    "fechaConstruccion": 1985,
    "gastosComunidad": 120,
    "ibi": 800
  }
}
```

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `executionId` | string | UUID v4 de la ejecución |
| `url` | string | URL original procesada |
| `timestamp` | string | Fecha/hora de procesamiento (ISO 8601) |
| `status` | string | Estado: `"completed"` |
| `extractedData` | object | Datos extraídos del inmueble |

#### 4.4.2 Estructura de extractedData

**Nota:** La estructura exacta puede variar según el portal inmobiliario y la información disponible en la ficha.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipo` | string | Tipo de inmueble (piso, casa, chalet, local, etc.) |
| `operacion` | string | Tipo de operación (venta, alquiler) |
| `precio` | number | Precio numérico |
| `moneda` | string | Moneda (EUR, USD, etc.) |
| `habitaciones` | number | Número de habitaciones |
| `banos` | number | Número de baños |
| `metrosCuadrados` | number | Superficie en m² |
| `planta` | string | Planta del inmueble |
| `direccion` | string | Dirección completa |
| `codigoPostal` | string | Código postal |
| `descripcion` | string | Descripción textual del inmueble |
| `caracteristicas` | array | Lista de características/amenidades |
| `imagenes` | array | URLs de imágenes del inmueble |
| `energiaCertificacion` | string | Certificación energética |
| `fechaConstruccion` | number | Año de construcción |
| `gastosComunidad` | number | Gastos de comunidad mensuales |
| `ibi` | number | IBI anual |

#### 4.4.3 Resultado No Disponible (404 Not Found)

**Código:** `404 Not Found`

**Causas:**
- El objeto no existe en R2
- El procesamiento aún no ha completado
- El procesamiento falló

**Body:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resultado no disponible",
    "details": "El resultado aún no está disponible o la ejecución falló. Consulte el estado en /status/:id"
  }
}
```

---

## 5. Códigos de Estado HTTP

### 5.1 Resumen

| Código | Nombre | Cuándo se usa |
|--------|--------|---------------|
| `200` | OK | Consulta exitosa (GET /status, GET /result) |
| `202` | Accepted | Procesamiento iniciado (POST /scrape) |
| `400` | Bad Request | Entrada inválida, UUID inválido |
| `401` | Unauthorized | Token inválido o no proporcionado |
| `404` | Not Found | Recurso no encontrado |
| `500` | Internal Server Error | Error interno del servidor |

### 5.2 Detalle por Código

#### 200 OK

**Endpoints:** `GET /status/:id`, `GET /result/:id`

**Significado:** La solicitud se procesó correctamente.

#### 202 Accepted

**Endpoints:** `POST /scrape`

**Significado:** La solicitud fue aceptada para procesamiento, pero el procesamiento no ha completado.

#### 400 Bad Request

**Endpoints:** Todos

**Significado:** La solicitud contiene errores de validación.

**Causas comunes:**
- Body JSON mal formado
- Campo `url` faltante en POST /scrape
- URL con formato inválido
- UUID con formato inválido

#### 401 Unauthorized

**Endpoints:** Todos

**Significado:** La autenticación falló.

**Causas comunes:**
- Header `Authorization` faltante
- Token inválido
- Token expirado (si se implementa expiración en futuro)

#### 404 Not Found

**Endpoints:** `GET /status/:id`, `GET /result/:id`

**Significado:** El recurso solicitado no existe.

**Causas comunes:**
- ID de ejecución no existe
- Resultado aún no disponible en R2

#### 500 Internal Server Error

**Endpoints:** Todos

**Significado:** Error interno del servidor.

**Causas comunes:**
- Error al consultar KV
- Error al consultar Workflow
- Error al leer R2
- Error no manejado en el código

---

## 6. Formato de Errores

### 6.1 Estructura Estándar

Todos los errores siguen la misma estructura:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Mensaje descriptivo en español",
    "details": "Detalles adicionales o array de detalles"
  }
}
```

### 6.2 Campos del Error

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `code` | string | Código de error en mayúsculas (snake_case) |
| `message` | string | Mensaje descriptivo corto |
| `details` | string \| array | Detalles adicionales o lista de errores de validación |

### 6.3 Catálogo de Errores

#### Errores de Autenticación

| Código | HTTP | Mensaje | Detalles |
|--------|------|---------|----------|
| `UNAUTHORIZED` | 401 | Token de API inválido o no proporcionado | El header Authorization debe contener un token válido |

#### Errores de Validación

| Código | HTTP | Mensaje | Detalles |
|--------|------|---------|----------|
| `BAD_REQUEST` | 400 | Entrada inválida | Array con errores específicos |
| `BAD_REQUEST` | 400 | El campo 'url' es requerido | - |
| `BAD_REQUEST` | 400 | El campo 'url' debe ser una URL válida con esquema http o https | - |
| `BAD_REQUEST` | 400 | ID de ejecución inválido | El ID debe ser un UUID v4 válido |

#### Errores de Recurso No Encontrado

| Código | HTTP | Mensaje | Detalles |
|--------|------|---------|----------|
| `NOT_FOUND` | 404 | Ejecución no encontrada | No existe ninguna ejecución con el ID proporcionado |
| `NOT_FOUND` | 404 | Resultado no disponible | El resultado aún no está disponible o la ejecución falló. Consulte el estado en /status/:id |

#### Errores Internos

| Código | HTTP | Mensaje | Detalles |
|--------|------|---------|----------|
| `INTERNAL_ERROR` | 500 | Error interno del servidor | Se produjo un error inesperado. Intente nuevamente más tarde |
| `WORKFLOW_ERROR` | 500 | Error al iniciar Workflow | No se pudo iniciar la instancia de Workflow |
| `R2_ERROR` | 500 | Error al acceder a R2 | No se pudo leer/escribir en el bucket R2 |
| `KV_ERROR` | 500 | Error al acceder a KV | No se pudo leer el secret desde KV |

### 6.4 Ejemplos de Errores

#### Error de Token Inválido

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token de API inválido o no proporcionado",
    "details": "El header Authorization debe contener un token válido"
  }
}
```

#### Error de URL Faltante

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Entrada inválida",
    "details": ["El campo 'url' es requerido"]
  }
}
```

#### Error de Múltiples Validaciones

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Entrada inválida",
    "details": [
      "El campo 'url' es requerido",
      "El body debe ser un JSON válido"
    ]
  }
}
```

#### Error de UUID Inválido

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "BAD_REQUEST",
    "message": "ID de ejecución inválido",
    "details": "El ID debe ser un UUID v4 válido"
  }
}
```

#### Error de Recurso No Encontrado

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ejecución no encontrada",
    "details": "No existe ninguna ejecución con el ID proporcionado"
  }
}
```

#### Error Interno del Servidor

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Error interno del servidor",
    "details": "Se produjo un error inesperado. Intente nuevamente más tarde"
  }
}
```

---

## 7. Ejemplos de Flujo Completo

### 7.1 Flujo Exitoso

#### Paso 1: Iniciar Procesamiento

```http
POST /scrape HTTP/1.1
Host: levantecofem.workers.dev
Content-Type: application/json
Authorization: Bearer mi-token-secreto

{
  "url": "https://www.idealista.com/inmueble/12345678/"
}
```

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "started",
  "message": "Procesamiento iniciado correctamente"
}
```

#### Paso 2: Consultar Estado (en progreso)

```http
GET /status/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: levantecofem.workers.dev
Authorization: Bearer mi-token-secreto
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "running",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "createdAt": "2026-03-07T10:30:00.000Z",
  "updatedAt": "2026-03-07T10:30:15.000Z"
}
```

#### Paso 3: Consultar Estado (completado)

```http
GET /status/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: levantecofem.workers.dev
Authorization: Bearer mi-token-secreto
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "createdAt": "2026-03-07T10:30:00.000Z",
  "updatedAt": "2026-03-07T10:32:00.000Z"
}
```

#### Paso 4: Recuperar Resultado

```http
GET /result/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: levantecofem.workers.dev
Authorization: Bearer mi-token-secreto
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "executionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "timestamp": "2026-03-07T10:32:00.000Z",
  "status": "completed",
  "extractedData": {
    "tipo": "piso",
    "operacion": "venta",
    "precio": 250000,
    "moneda": "EUR",
    "habitaciones": 3,
    "banos": 2,
    "metrosCuadrados": 95,
    "direccion": "Calle Ejemplo 123, Madrid",
    "descripcion": "Piso luminoso...",
    "caracteristicas": ["ascensor", "calefaccion"],
    "imagenes": ["https://...", "https://..."]
  }
}
```

### 7.2 Flujo con Error de Validación

```http
POST /scrape HTTP/1.1
Host: levantecofem.workers.dev
Content-Type: application/json
Authorization: Bearer mi-token-secreto

{
  "url": "no-es-una-url-valida"
}
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Entrada inválida",
    "details": ["El campo 'url' debe ser una URL válida con esquema http o https"]
  }
}
```

### 7.3 Flujo con Error de Autenticación

```http
POST /scrape HTTP/1.1
Host: levantecofem.workers.dev
Content-Type: application/json
Authorization: Bearer token-incorrecto

{
  "url": "https://www.idealista.com/inmueble/12345678/"
}
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token de API inválido o no proporcionado",
    "details": "El header Authorization debe contener un token válido"
  }
}
```

### 7.4 Flujo con Error de Procesamiento

#### Paso 1: Iniciar Procesamiento

```http
POST /scrape HTTP/1.1
Host: levantecofem.workers.dev
Content-Type: application/json
Authorization: Bearer mi-token-secreto

{
  "url": "https://www.idealista.com/inmueble/12345678/"
}
```

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "started",
  "message": "Procesamiento iniciado correctamente"
}
```

#### Paso 2: Consultar Estado (fallido)

```http
GET /status/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: levantecofem.workers.dev
Authorization: Bearer mi-token-secreto
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "failed",
  "url": "https://www.idealista.com/inmueble/12345678/",
  "createdAt": "2026-03-07T10:30:00.000Z",
  "updatedAt": "2026-03-07T10:31:00.000Z",
  "error": "Error al obtener contenido HTTP: timeout"
}
```

---

## 8. Consideraciones de CORS

### 8.1 Configuración Actual

CORS es configurado automáticamente por `cloudflare-wrangler`. La configuración específica de orígenes permitidos se definirá en el Sprint 2.

### 8.2 Headers CORS Esperados

| Header | Valor (pendiente de confirmación) |
|--------|-----------------------------------|
| `Access-Control-Allow-Origin` | Por confirmar |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, Authorization` |
| `Access-Control-Max-Age` | `86400` |

### 8.3 Request Preflight (OPTIONS)

```http
OPTIONS /scrape HTTP/1.1
Host: levantecofem.workers.dev
Origin: https://mi-app.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

---

## 9. Rate Limiting

### 9.1 Configuración Actual

El rate limiting no está implementado en esta fase base. Será considerado en fases futuras.

### 9.2 Headers de Rate Limiting (Futuro)

| Header | Descripción |
|--------|-------------|
| `X-RateLimit-Limit` | Número máximo de requests por ventana |
| `X-RateLimit-Remaining` | Requests restantes en la ventana |
| `X-RateLimit-Reset` | Timestamp de reseteo de la ventana |

---

## 10. Versionado de API

### 10.1 Estrategia de Versionado

La API no incluye versión en la ruta en esta fase base. El versionado futuro se manejará mediante:

- **Opción preferida:** Header `Accept` con versión
- **Opción alternativa:** Prefijo en ruta (`/v1/scrape`)

### 10.2 Header de Versión (Futuro)

```http
Accept: application/vnd.apiinmobase.v1+json
```

---

## 11. Referencias

- [RFC 7231 - HTTP/1.1 Semantics and Content](https://tools.ietf.org/html/rfc7231)
- [RFC 3986 - Uniform Resource Identifier (URI): Generic Syntax](https://tools.ietf.org/html/rfc3986)
- [RFC 4180 - Common Format and MIME Type for CSV Files](https://tools.ietf.org/html/rfc4180)
- [Cloudflare Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/)
- [Cloudflare Workflows Trigger Workflows](https://developers.cloudflare.com/workflows/build/trigger-workflows/)

---

**FIN DEL CONTRATO DE API**
