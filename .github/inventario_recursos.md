# Inventario de recursos

## Finalidad

Este archivo es la **fuente de verdad operativa** para recursos Cloudflare y CI del proyecto.

Debe reflejar el estado conocido y confirmado de:

- recursos Cloudflare;
- bindings;
- variables de entorno;
- secretos gestionados fuera del repositorio;
- integración de despliegue y CI;
- vacíos pendientes de confirmación por el usuario.

## Reglas de uso

- No inventar valores.
- No incluir secretos ni credenciales en texto plano.
- Actualizar al final de cada instrucción del usuario que afecte a operación, despliegue, recursos, bindings, secretos o configuración.
- Todo agente debe consultarlo antes de ejecutar trabajo con impacto operativo.

## 1. Resumen del proyecto

- Nombre del proyecto: **Pendiente de confirmación por el usuario**
- Finalidad: **Plantilla reutilizable para proyectos desplegados en Cloudflare**
- Entorno principal de trabajo: **GitHub Codespaces, GitHub Copilot y Claude Code**
- Lenguaje base previsto: **TypeScript**
- Entornos de despliegue: **dev**
- Dominio: **levantecofem.workers.dev**

## 2. Recursos Cloudflare

| Tipo | Nombre | Estado | Uso | Observaciones |
|------|--------|--------|-----|---------------|
| Worker | worker-uno | **Eliminado** | Prueba temporal | Usuario proporcionó nombre. Eliminado tras validación del primer despliegue de prueba |
| Worker | wk-api-inmo | ✅ **Desplegado** | Worker lanzador | Worker principal del proyecto. Desplegado en https://wk-api-inmo.levantecofem.workers.dev |
| Workflow | wf-api-inmo | ✅ **Configurado** | Workflow ejecutor| Workflow principal del proyecto. Clase `WfApiInmo` en `src/workflow.ts` |
| KV Namespace | secrets-api-inmo | ✅ **Creado** | Secretos Cloudflare | namespace_id: `b9e80742f2a74d89b3e9083245b35709`. Secrets: `TOKEN-API-INMO`, `OPENAI_API_KEY` |
| D1 | Pendiente de confirmación | Pendiente | Pendiente | Solo crear si el usuario lo define |
| R2 Bucket | r2-almacen | Creado por usuario | Almacenamiento gral del proyecto |  |
| R2 directorio | dir-api-inmo | Creado por usuario | Almacenamiento JSON |  |
| Queue | Pendiente de confirmación | Pendiente | Pendiente | Solo crear si el usuario lo define |

## 3. Wrangler y despliegue

- Uso de Cloudflare Wrangler: **Previsto**
- Archivo de configuración: **wrangler.toml (creado)**
- Cuenta Cloudflare: **ver 5. Secrets y credenciales**
- `account_id`: **No documentado y no debe fijarse sin validación**
- Método de autenticación para despliegue: **GitHub Actions + cloudflare/wrangler-action@v3**

## 4. Bindings y variables de entorno

| Clave o binding | Tipo | Estado | Ubicación | Observaciones |
|-----------------|------|--------|-----------|---------------|
| WF_API_INMO | Workflow | ✅ **Configurado** | wrangler.toml | Binding a Workflow `wf-api-inmo`, class_name: `WfApiInmo` |
| DIR_API_INMO | R2 | ✅ **Configurado** | wrangler.toml | Binding a R2 `dir-api-inmo` (bucket pendiente de creación) |
| SECRETS_API_INMO | KV | ✅ **Configurado** | wrangler.toml | Binding a KV `secrets-api-inmo` (namespace_id: `b9e80742f2a74d89b3e9083245b35709`) |
| ENVIRONMENT | Variable | ✅ **Configurado** | wrangler.toml | Entorno (`dev` / `production`) |
| LOG_LEVEL | Variable | ✅ **Configurado** | wrangler.toml | Nivel de log (`debug` / `info`) |

## 5. Secrets y credenciales

| Nombre lógico | Sistema de gestión | Estado | Observaciones |
|---------------|--------------------|--------|---------------|
| CF_API_TOKEN | GitHub Secrets | Configurado en GitHub | No documentar valores |
| CF_ACCOUNT_ID | GitHub Secrets | Configurado en GitHub | No documentar valores |
| CF_API_TOKEN | Codespaces Secrets | Configurado en GitHub | No documentar valores |
| CF_ACCOUNT_ID | Codespaces Secrets | Configurado en GitHub | No documentar valores |
| TOKEN-API-INMO | KV | Configurado en Cloudflare | KV Namespace: secrets-api-inmo Token para validar al consumir API del Worker wk-api-inmo |
| OPENAI_API_KEY | KV | Configurado en Cloudflare | KV Namespace: secrets-api-inmo Key API de OpenAI |

## 6. GitHub y CI/CD

- Repositorio GitHub: **Existe y está vacío al inicio**
- GitHub Actions: **Configurado (deploy.yml)**
- GitHub Secrets requeridos para Cloudflare: **CF_API_TOKEN, CF_ACCOUNT_ID**
- Integración con GitHub Copilot: **Sí**
- Integración con GitHub Codespaces: **Sí**

## 7. Restricciones operativas confirmadas

- El agente orquestador es **puramente lógico de coordinación**.
- La entrada principal es el **chat del entorno de desarrollo** con instrucciones del usuario.
- El agente orquestador debe **validar, advertir, bloquear, rechazar, exigir evidencias y registrar incumplimientos**.
- No debe mantenerse memoria persistente fuera del trabajo corriente.

## 8. Vacíos pendientes de confirmación

- ~~Nombre real del proyecto~~ ✅ **RESUELTO:** `ApiInmoBase`
- ~~Nombre de los recursos Cloudflare~~ ✅ **RESUELTOS:** `wk-api-inmo`, `wf-api-inmo`, `dir-api-inmo`, `secrets-api-inmo`
- ~~Dominios y orígenes CORS~~ ✅ **RESUELTO:** Dominio `levantecofem.workers.dev`, CORS automático por Wrangler
- ~~Estrategia de pruebas del proyecto~~ ✅ **RESUELTO:** Tests básicos configurados, tests unitarios/integración pendientes
- ~~namespace_id de KV~~ ✅ **RESUELTO:** `b9e80742f2a74d89b3e9083245b35709`
- ⏳ **R2 habilitado en Cloudflare Dashboard** - ~~Requiere acción manual del usuario para habilitar R2 y crear bucket `dir-api-inmo`~~ ✅ **RESUELTO:** Bucket `r2-almacen` creado y configurado en wrangler.toml

## 9. Historial operativo

- 2026-03-06: Se crea la plantilla inicial del agente orquestador, tres agentes ejecutores mínimos y este inventario base.
- 2026-03-07: Se incorpora `cloudflare/wrangler-action@v3`. Se crean: `deploy.yml`, `wrangler.toml`, `package.json`, `tsconfig.json`, `src/index.ts`, `.gitignore`. Worker `worker-uno` configurado para entorno `dev`.
- 2026-03-07: Se elimina parámetro `ctx` no utilizado en `src/index.ts`. Se actualiza dominio en `wrangler.toml` a `worker-uno.pages.dev`. Secrets marcados como "Configurado en GitHub" en inventario.
- 2026-03-07: **Corrección de error de despliegue:** Se elimina línea `route = { pattern = "worker-uno.pages.dev", zone_name = "pages.dev" }` de `wrangler.toml` debido a error `Could not find zone for 'pages.dev'`. Configuración `route` removida completamente del entorno `dev`.
- 2026-03-07: **Actualización para ApiInmoBase:** Se confirman nombres de recursos (`wk-api-inmo`, `wf-api-inmo`, `dir-api-inmo`, `secrets-api-inmo`). KV `secrets-api-inmo` creado con secrets `TOKEN-API-INMO` y `OPENAI_API_KEY`. Dominio confirmado: `levantecofem.workers.dev`. CORS automático por Wrangler.
- 2026-03-07: **Sprint 0 completado:** Diseño arquitectónico documentado en `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/SECURITY.md`. Bindings añadidos al inventario: `WF_API_INMO`, `DIR_API_INMO`, `SECRETS_API_INMO`.
- 2026-03-07: **Sprint 1 completado:** `wrangler.toml` actualizado con bindings. `package.json` actualizado. `src/index.ts` con interface `Env`. `src/workflow.ts` creado con clase `WfApiInmo`. Worker `wk-api-inmo` desplegado. namespace_id de KV obtenido: `b9e80742f2a74d89b3e9083245b35709`. R2 bucket `r2-almacen` verificado y configurado.
- 2026-03-07: **Sprint 2 completado:** Worker público implementado con endpoints `POST /scrape`, `GET /status/:id`, `GET /result/:id`. Validación de token desde KV implementada. Manejo de errores (401, 400, 404, 500) configurado. CORS habilitado. Health check endpoint añadido. Token de API: `tok_zs3ylO53GZYzZcTR4cIEgjnjBlAW59wfDdiEjV8g_7Fq9Kx2LmP`.

## 10. Archivos de configuración creados

| Archivo | Finalidad | Estado |
|---------|-----------|--------|
| .github/workflows/deploy.yml | CI/CD para Cloudflare | Creado |
| .github/inventario_recursos.md | Inventario de recursos | Creado |
| wrangler.toml | Configuración de Wrangler | Creado |
| package.json | Dependencias y scripts | Creado |
| tsconfig.json | Configuración TypeScript | Creado |
| src/index.ts | Worker entry point (HTTP handlers) | Creado |
| src/workflow.ts | Workflow class (WfApiInmo) | Creado |
| .gitignore | Exclusiones de versionado | Creado |
