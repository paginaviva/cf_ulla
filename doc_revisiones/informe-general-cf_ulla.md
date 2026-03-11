# Informe General del Proyecto - cf_ulla

**Documento:** `doc_revisiones/informe-general-cf_ulla.md`  
**Fecha de generación:** 2026-03-11  
**Estado del proyecto:** Sprint 0 completado - Diseño arquitectónico finalizado  

---

## 1. Descripción General del Proyecto

### 1.1 Propósito Principal

**cf_ulla** es un proyecto de API serverless desplegada en **Cloudflare Workers** diseñado para el procesamiento y extracción de datos de fichas inmobiliarias de portales web. El sistema recibe una URL de una propiedad, inicia un flujo de procesamiento durable mediante **Cloudflare Workflows**, obtiene el contenido HTTP de la página, extrae datos estructurados utilizando la **API de OpenAI**, almacena los resultados en **Cloudflare R2** y permite la consulta posterior del estado o del resultado mediante un identificador único (UUID).

### 1.2 Funcionalidad Principal

El proyecto implementa un sistema de scraping inteligente con las siguientes capacidades:

| Funcionalidad | Descripción |
|--------------|-------------|
| **Recepción de URLs** | Endpoint HTTP que acepta URLs de fichas inmobiliarias |
| **Validación de seguridad** | Autenticación mediante Bearer Token almacenado en KV |
| **Procesamiento durable** | Orquestación mediante Cloudflare Workflows para operaciones de larga duración |
| **Extracción con IA** | Uso de OpenAI GPT-3.5-turbo para extraer datos estructurados del HTML |
| **Almacenamiento persistente** | Guardado de resultados en Cloudflare R2 |
| **Consulta de estado** | Endpoints para consultar el estado de procesamiento y recuperar resultados |

### 1.3 Tipo de Aplicación

- **Arquitectura:** Serverless / Edge Computing
- **Plataforma:** Cloudflare Workers
- **Modelo de ejecución:** Asíncrono con polling de estado
- **Dominio de despliegue:** `levantecofem.workers.dev`

---

## 2. Tecnologías Utilizadas

### 2.1 Lenguajes de Programación

| Lenguaje | Versión | Uso |
|----------|---------|-----|
| **TypeScript** | ^5.3.3 | Lenguaje principal para todo el código |
| **JavaScript (ESNext)** | ES2021 | Módulo objetivo para Cloudflare Workers |

### 2.2 Bases de Datos y Almacenamiento

| Recurso | Tipo | Nombre | Finalidad |
|---------|------|--------|-----------|
| **Cloudflare R2** | Object Storage | `r2-almacen` | Almacenamiento de resultados JSON del procesamiento |
| **Cloudflare KV** | Key-Value Store | `secrets-api-inmo` (ID: `b9e80742f2a74d89b3e9083245b35709`) | Almacenamiento seguro de secrets y claves de API |
| **Cloudflare Workflows** | Orquestación durable | `wf-api-inmo` | Ejecución durable del flujo de procesamiento |

### 2.3 Frameworks y Librerías

| Dependencia | Versión | Tipo | Finalidad |
|-------------|---------|------|-----------|
| `@cloudflare/workers-types` | ^4.20240117.0 | DevDependency | Tipos de TypeScript para Cloudflare Workers API |
| `wrangler` | ^3.28.0 | DevDependency | CLI de Cloudflare para desarrollo y despliegue |
| `typescript` | ^5.3.3 | DevDependency | Compilador y language server de TypeScript |

### 2.4 Herramientas de Desarrollo y Despliegue

| Herramienta | Uso |
|-------------|-----|
| **Cloudflare Wrangler** | CLI oficial para desarrollo, testing y despliegue en Cloudflare |
| **GitHub Actions** | CI/CD para despliegue automático a Cloudflare |
| **cloudflare/wrangler-action@v3** | Acción de GitHub para integración con Cloudflare |
| **Node.js** | ^20.0.0 - Entorno de ejecución para desarrollo y build |

### 2.5 APIs Externas

| API | Uso |
|-----|-----|
| **OpenAI API** | Extracción de datos estructurados mediante GPT-3.5-turbo |
| **Fetch API** | Obtención de contenido HTTP de URLs inmobiliarias |

---

## 3. Arquitectura y Componentes del Proyecto

### 3.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE HTTP                             │
│                      (Navegador / API)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ POST /scrape + Token
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│           CLOUDFLARE WORKER: wk-api-inmo                        │
│                    (Punto de entrada API)                       │
│  - Valida token de API (KV)                                     │
│  - Valida entrada (URL)                                         │
│  - Inicia Workflow                                              │
│  - Devuelve respuesta asíncrona                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ create(instance)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│          CLOUDFLARE WORKFLOW: wf-api-inmo                       │
│               (Ejecución durable del flujo)                     │
│  Paso 1: Obtener contenido HTTP                                 │
│  Paso 2: Preparar contenido                                     │
│  Paso 3: Llamar a OpenAI API                                    │
│  Paso 4: Generar JSON final                                     │
│  Paso 5: Guardar en R2                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ put(object)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│            CLOUDFLARE R2: r2-almacen                            │
│         (Almacenamiento de resultados JSON)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Componentes Principales

#### 3.2.1 Cloudflare Worker (`wk-api-inmo`)

**Archivo:** `src/index.ts`

**Responsabilidad:** Punto de entrada público de la API HTTP.

**Funciones principales:**

| Función | Descripción |
|---------|-------------|
| Validación de token | Consulta KV `secrets-api-inmo` para validar Bearer Token |
| Validación de entrada | Verifica formato y esquema de URL |
| Generación de UUID | Crea identificador único para cada ejecución |
| Inicio de Workflow | Invoca `WF_API_INMO.create()` para iniciar procesamiento |
| Health check | Endpoint `/health` para verificación de estado |
| Consulta de estado | Endpoint `GET /status/:id` para consultar estado |
| Recuperación de resultado | Endpoint `GET /result/:id` para obtener JSON desde R2 |

**Endpoints:**

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| `POST` | `/scrape` | Iniciar procesamiento de URL | Requerida |
| `GET` | `/status/:id` | Consultar estado de ejecución | Requerida |
| `GET` | `/result/:id` | Recuperar resultado JSON | Requerida |
| `GET` | `/health` | Health check del Worker | No requerida |

#### 3.2.2 Cloudflare Workflow (`wf-api-inmo`)

**Archivo:** `src/workflow.ts`

**Responsabilidad:** Motor de ejecución durable del flujo operativo.

**Clase base:** `WorkflowEntrypoint<Env, WorkflowParams>`

**Método principal:** `run(event: WorkflowEvent, step: WorkflowStep)`

**Pasos del flujo:**

| Paso | Operación | Descripción |
|------|-----------|-------------|
| 1 | Obtener contenido HTTP | `fetch(url)` con validación de status 200 |
| 2 | Preparar contenido | Limitar tamaño (max 100KB) para OpenAI |
| 3 | Llamar a OpenAI API | POST a `chat/completions` con prompt de extracción |
| 4 | Generar JSON final | Estructurar datos extraídos |
| 5 | Guardar en R2 | `put()` del resultado en bucket |
| 6 | Actualizar estado | Marcar instancia como `completed` o `failed` |

**Reintentos configurados:** 3 intentos con backoff exponencial por paso.

#### 3.2.3 Cloudflare R2 (`r2-almacen`)

**Responsabilidad:** Almacenamiento persistente de resultados JSON.

**Estructura de almacenamiento:**

- **Bucket:** `r2-almacen`
- **Binding en código:** `DIR_API_INMO`
- **Clave de objeto:** `dir-api-inmo/{executionId}.json`
- **Formato:** UUID v4 + extensión `.json`

**Estructura del objeto almacenado:**

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
    "descripcion": "...",
    "caracteristicas": [...],
    "imagenes": [...]
  }
}
```

#### 3.2.4 Cloudflare KV (`secrets-api-inmo`)

**Responsabilidad:** Almacenamiento seguro de secrets y claves.

**Namespace ID:** `b9e80742f2a74d89b3e9083245b35709`

**Binding en código:** `SECRETS_API_INMO`

**Claves almacenadas:**

| Clave | Descripción | Sensibilidad |
|-------|-------------|--------------|
| `TOKEN-API-INMO` | Token para validar consumo de API | Alta |
| `OPENAI_API_KEY` | Clave de API de OpenAI | Crítica |

### 3.3 Bindings y Configuración

**Archivo de configuración:** `wrangler.toml`

**Bindings configurados:**

| Binding | Tipo | Nombre en Código | Recurso Cloudflare |
|---------|------|------------------|-------------------|
| `WF_API_INMO` | Workflow | `env.WF_API_INMO` | `wf-api-inmo` |
| `DIR_API_INMO` | R2 | `env.DIR_API_INMO` | `r2-almacen` |
| `SECRETS_API_INMO` | KV | `env.SECRETS_API_INMO` | `secrets-api-inmo` |

**Entornos configurados:**

| Entorno | Nombre del Worker | LOG_LEVEL |
|---------|-------------------|-----------|
| `dev` | `wk-api-inmo-dev` | `debug` |
| `production` | `wk-api-inmo` | `info` |

---

## 4. Inventario de Archivos y Recursos Importantes

### 4.1 Archivos de Configuración

| Archivo | Finalidad | Estado |
|---------|-----------|--------|
| `wrangler.toml` | Configuración de Wrangler, bindings y entornos | ✅ Configurado |
| `tsconfig.json` | Configuración de TypeScript | ✅ Configurado |
| `package.json` | Dependencias y scripts npm | ✅ Configurado |
| `.gitignore` | Exclusiones de versionado | ✅ Configurado |

### 4.2 Archivos de Código Fuente

| Archivo | Finalidad | Estado |
|---------|-----------|--------|
| `src/index.ts` | Worker principal - punto de entrada API | ✅ Implementado |
| `src/workflow.ts` | Workflow - procesamiento durable | ✅ Implementado |

### 4.3 Archivos de CI/CD

| Archivo | Finalidad | Estado |
|---------|-----------|--------|
| `.github/workflows/deploy.yml` | GitHub Actions para despliegue automático | ✅ Configurado |

### 4.4 Documentación del Proyecto

| Archivo / Carpeta | Finalidad | Estado |
|-------------------|-----------|--------|
| `README.md` | Descripción general del proyecto | ✅ Existe |
| `docs/API_CONTRACT.md` | Especificación completa de la API | ✅ Completado |
| `docs/ARCHITECTURE.md` | Arquitectura y diagramas de flujo | ✅ Completado |
| `docs/SECURITY.md` | Especificación de seguridad | ✅ Completado |
| `docs/SPRINT_0_SUMMARY.md` | Resumen del Sprint 0 | ✅ Completado |

### 4.5 Agentes y Reglas del Proyecto

**Carpeta:** `.claude/`

| Archivo | Finalidad |
|---------|-----------|
| `agente-orquestador.md` | Orquestador principal del proyecto |
| `cloudflare-workers.md` | Agente especializado en Cloudflare Workers |
| `cloudflare-workflows.md` | Agente especializado en Cloudflare Workflows |
| `cloudflare-r2.md` | Agente especializado en Cloudflare R2 |
| `cloudflare-wrangler.md` | Agente especializado en Wrangler y despliegue |
| `code-validator.md` | Validador de calidad y cumplimiento de reglas |
| `natural-language-interpreter.md` | Intérprete de lenguaje natural |

### 4.6 Scripts Disponibles (package.json)

| Script | Comando | Finalidad |
|--------|---------|-----------|
| `dev` | `wrangler dev` | Desarrollo local con hot-reload |
| `build` | `tsc --noEmit` | Verificación de tipos sin emisión |
| `deploy` | `wrangler deploy` | Despliegue a Cloudflare |
| `tail` | `wrangler tail` | Ver logs en tiempo real |
| `lint` | `eslint src/**/*.ts` | Ejecutar linter |
| `test` | `echo "No tests configured yet"` | Ejecutar tests (no configurado) |

---

## 5. Índice de Documentación

### 5.1 Documentación Técnica Principal

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| **README** | `/README.md` | Descripción general del proyecto y del río Ulla |
| **Contrato de API** | `/docs/API_CONTRACT.md` | Especificación completa de endpoints, payloads, errores y ejemplos de flujo |
| **Arquitectura** | `/docs/ARCHITECTURE.md` | Diagramas de flujo, componentes, bindings y decisiones técnicas |
| **Seguridad** | `/docs/SECURITY.md` | Autenticación, CORS, validación de entrada, manejo de secrets |
| **Resumen Sprint 0** | `/docs/SPRINT_0_SUMMARY.md` | Estado del diseño arquitectónico y próximos pasos |

### 5.2 Documentación de Agentes

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| **Agente Orquestador** | `/.claude/agente-orquestador.md` | Coordinación, validación y delegación de tareas |
| **Cloudflare Workers** | `/.claude/cloudflare-workers.md` | Especialista en endpoints HTTP, CORS y bindings |
| **Cloudflare Workflows** | `/.claude/cloudflare-workflows.md` | Especialista en Workflows y código auxiliar en Workers |
| **Cloudflare R2** | `/.claude/cloudflare-r2.md` | Especialista en almacenamiento R2 y acceso a objetos |
| **Cloudflare Wrangler** | `/.claude/cloudflare-wrangler.md` | Especialista en Wrangler, CI/CD y despliegue |
| **Code Validator** | `/.claude/code-validator.md` | Validación de calidad, lint, typecheck y tests |
| **NLI** | `/.claude/natural-language-interpreter.md` | Interpretación de instrucciones en lenguaje natural |

### 5.3 Documentación de Configuración

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| **Inventario Ejemplo** | `/.github/inventario_recursos_example.md` | Plantilla para el inventario operativo de recursos |
| **Instrucciones Copilot** | `/.github/copilot-instructions.md` | Reglas para GitHub Copilot |
| **Workflow Deploy** | `/.github/workflows/deploy.yml` | CI/CD para despliegue automático |

---

## 6. Opciones de Despliegue

### 6.1 Entornos de Despliegue Configurados

| Entorno | Worker | Dominio | Estado |
|---------|--------|---------|--------|
| **Desarrollo** | `wk-api-inmo-dev` | `levantecofem.workers.dev` | Configurado en wrangler.toml |
| **Producción** | `wk-api-inmo` | `levantecofem.workers.dev` | Configurado en wrangler.toml |

### 6.2 Opciones de Despliegue Compatibles

#### 6.2.1 Cloudflare Workers ✅ **OPCIÓN PRINCIPAL**

**Compatibilidad:** Nativa - El proyecto está diseñado específicamente para esta plataforma.

**Ventajas:**
- Arquitectura serverless nativa
- Ejecución en edge (baja latencia)
- Integración directa con Workflows, R2 y KV
- Escalado automático
- Coste por uso (gratis hasta ciertos límites)

**Requisitos:**
- Cuenta de Cloudflare
- `CF_API_TOKEN` y `CF_ACCOUNT_ID` en GitHub Secrets

**Comando de despliegue:**
```bash
npm run deploy
```

#### 6.2.2 Cloudflare Pages Functions ✅ **COMPATIBLE**

**Compatibilidad:** Alta - Mismo runtime de Workers.

**Ventajas:**
- Integración con Cloudflare Pages
- Despliegue automático desde Git
- Previews automáticos por PR

**Consideraciones:**
- Requiere reestructurar a estructura de Pages Functions
- Mismas capacidades de bindings

#### 6.2.3 Otros Proveedores Serverless ⚠️ **COMPATIBILIDAD LIMITADA**

| Plataforma | Compatibilidad | Consideraciones |
|------------|----------------|-----------------|
| **Vercel Edge Functions** | Parcial | Requiere adaptar código a runtime de Vercel |
| **Netlify Edge Functions** | Parcial | Requiere adaptar bindings y configuración |
| **AWS Lambda@Edge** | Baja | Cambio significativo de arquitectura |
| **Google Cloud Run** | Parcial | Requiere contenerización y cambios de código |

#### 6.2.4 Contenedores ⚠️ **REQUIERE ADAPTACIÓN**

**Compatibilidad:** Media - Requiere cambios significativos.

**Opciones:**
- **Docker + Node.js:** Empaquetar aplicación como contenedor
- **Kubernetes:** Orquestación de contenedores

**Consideraciones:**
- Pérdida de ventajas de edge computing
- Requiere gestionar infraestructura
- Bindings de Cloudflare no disponibles

#### 6.2.5 VPS / Hosting Compartido ❌ **NO COMPATIBLE**

**Compatibilidad:** No compatible directamente.

**Razones:**
- El código usa APIs específicas de Cloudflare Workers
- Workflows y R2 son servicios propietarios de Cloudflare
- Requiere reescribir completamente la arquitectura

### 6.3 Recomendación de Despliegue

**Opción recomendada:** **Cloudflare Workers** (configuración actual)

**Justificación:**
1. El proyecto está diseñado nativamente para Cloudflare
2. Usa servicios específicos (Workflows, R2, KV) solo disponibles en Cloudflare
3. La arquitectura serverless edge es óptima para el caso de uso
4. El CI/CD ya está configurado para despliegue automático

---

## 7. Observaciones Técnicas Relevantes

### 7.1 Dependencias Críticas

| Dependencia | Criticalidad | Impacto si no disponible |
|-------------|--------------|-------------------------|
| **OpenAI API Key** | Crítica | El workflow no puede extraer datos |
| **Token de API (KV)** | Crítica | No se puede autenticar ningún request |
| **Cloudflare Workflows** | Crítica | No hay procesamiento durable |
| **Cloudflare R2** | Crítica | No hay almacenamiento de resultados |
| **Cloudflare KV** | Crítica | No hay gestión de secrets |

### 7.2 Requisitos de Ejecución

| Requisito | Versión | Notas |
|-----------|---------|-------|
| **Node.js** | >=20.0.0 | Requerido para desarrollo y build |
| **npm** | Latest | Gestor de paquetes |
| **Wrangler CLI** | ^3.28.0 | Herramienta de despliegue |
| **TypeScript** | ^5.3.3 | Lenguaje principal |

### 7.3 Límites Técnicos de Cloudflare

| Límite | Valor | Impacto en el proyecto |
|--------|-------|----------------------|
| **Timeout de Worker (request)** | 30s (dev), 60s (prod) | El workflow se ejecuta asíncronamente |
| **Timeout de Workflow step** | 10 min | Suficiente para cada paso del flujo |
| **Tamaño máximo de objeto R2** | 5 TB | No es limitante para JSON |
| **Tamaño máximo de valor KV** | 25 MB | Suficiente para tokens y keys |
| **CPU time de Worker** | 10 ms (dev), 50 ms (prod) | Considerar para optimización |

### 7.4 Consideraciones de Seguridad

| Aspecto | Estado | Observaciones |
|---------|--------|---------------|
| **Secrets en código** | ✅ No hay | Todos los secrets están en KV |
| **Hardcoding de configuración** | ✅ No hay | Usa bindings y variables de entorno |
| **Validación de entrada** | ✅ Implementada | URL, token y Content-Type validados |
| **CORS** | ⏳ Pendiente de configuración | Configurado como `*` por defecto |
| **Rate limiting** | ❌ No implementado | Pendiente para fases futuras |
| **Logs sin datos sensibles** | ✅ Implementado | Solo se loguea información segura |

### 7.5 Limitaciones Actuales

| Limitación | Estado | Plan de resolución |
|------------|--------|-------------------|
| **Tests automatizados** | ❌ No configurados | Pendiente en Sprint 0/1 |
| **CORS específico por origen** | ⏳ Pendiente | Sprint 2 |
| **Namespace ID de KV en inventario** | ⏳ Pendiente | Sprint 1 |
| **Política de conservación en R2** | ❌ No definida | Sprint 5 |
| **Multiportal avanzado** | ❌ No implementado | Fases futuras |

### 7.6 Puntos de Ampliación Futura

| Área | Descripción | Prioridad |
|------|-------------|-----------|
| **Autenticación avanzada** | Sistema de usuarios, roles, API keys por cliente | Media |
| **Rate limiting** | Límites de peticiones por cliente/ventana | Media |
| **Batch de URLs** | Procesamiento múltiple de URLs por petición | Baja |
| **Notificaciones** | Webhooks o emails al completar procesamiento | Baja |
| **Enriquecimiento de datos** | Validación, normalización, clasificación | Baja |
| **TTL en R2** | Política de borrado automático | Baja |

### 7.7 Estado del Proyecto

**Sprint actual:** Sprint 0 completado

**Entregables del Sprint 0:**
- ✅ Diseño arquitectónico documentado
- ✅ Contrato de API especificado
- ✅ Especificación de seguridad definida
- ✅ Código base del Worker implementado
- ✅ Código base del Workflow implementado
- ✅ Configuración de Wrangler completada
- ✅ CI/CD configurado con GitHub Actions

**Pendientes no bloqueantes:**
- ⏳ CORS específico por origen (Sprint 2)
- ⏳ Estrategia de pruebas (Sprint 0/1)
- ⏳ Namespace ID de KV en inventario (Sprint 1)

---

## 8. Resumen Ejecutivo

### 8.1 Fortalezas del Proyecto

1. **Arquitectura limpia y bien documentada** - Separación clara de responsabilidades
2. **Uso nativo de servicios Cloudflare** - Aprovecha Workflows, R2 y KV de forma óptima
3. **Seguridad implementada** - Secrets en KV, validación de entrada, logs seguros
4. **CI/CD configurado** - Despliegue automático desde GitHub
5. **Documentación completa** - API, arquitectura y seguridad especificadas

### 8.2 Riesgos Identificados

1. **Dependencia de OpenAI** - El procesamiento depende completamente de la API externa
2. **Timeouts potenciales** - URLs lentas pueden causar timeout en obtención HTTP
3. **CORS no configurado específicamente** - Actualmente permite todos los orígenes
4. **Sin tests automatizados** - No hay validación automática de funcionalidad

### 8.3 Recomendaciones

1. **Completar configuración de CORS** - Definir orígenes permitidos específicos
2. **Implementar tests básicos** - Al menos tests unitarios para validaciones
3. **Configurar rate limiting** - Prevenir abuso de la API
4. **Actualizar inventario operativo** - Completar `.github/inventario_recursos.md`
5. **Rotar secrets periódicamente** - Establecer calendario de rotación de tokens

---

**FIN DEL INFORME GENERAL**

*Documento generado automáticamente como parte del análisis del repositorio cf_ulla*
