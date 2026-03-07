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

## 2. Recursos Cloudflare

| Tipo | Nombre | Estado | Uso | Observaciones |
|------|--------|--------|-----|---------------|
| Worker | worker-uno | **Creado** | Prueba temporal | Usuario proporcionó nombre |
| KV | Pendiente de confirmación | Pendiente | Pendiente | Solo crear si el usuario lo define |
| D1 | Pendiente de confirmación | Pendiente | Pendiente | Solo crear si el usuario lo define |
| R2 | Pendiente de confirmación | Pendiente | Pendiente | Solo crear si el usuario lo define |
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
| Pendiente de confirmación | Pendiente | Pendiente | Pendiente | No inventar nombres |

## 5. Secrets y credenciales

| Nombre lógico | Sistema de gestión | Estado | Observaciones |
|---------------|--------------------|--------|---------------|
| CF_API_TOKEN | GitHub Secrets | Configurado en GitHub | No documentar valores |
| CF_ACCOUNT_ID | GitHub Secrets | Configurado en GitHub | No documentar valores |
| CF_API_TOKEN | Codespaces Secrets | Configurado en GitHub | No documentar valores |
| CF_ACCOUNT_ID | Codespaces Secrets | Configurado en GitHub | No documentar valores |

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

- Nombre real del proyecto
- Nombre de los recursos Cloudflare que se creen (KV, D1, R2, Queue)
- Dominios y orígenes CORS si existen
- Estrategia de pruebas del proyecto
- Estructura exacta del despliegue en Cloudflare

## 9. Historial operativo

- 2026-03-06: Se crea la plantilla inicial del agente orquestador, tres agentes ejecutores mínimos y este inventario base.
- 2026-03-07: Se incorpora `cloudflare/wrangler-action@v3`. Se crean: `deploy.yml`, `wrangler.toml`, `package.json`, `tsconfig.json`, `src/index.ts`, `.gitignore`. Worker `worker-uno` configurado para entorno `dev`.
- 2026-03-07: Se elimina parámetro `ctx` no utilizado en `src/index.ts`. Se actualiza dominio en `wrangler.toml` a `worker-uno.pages.dev`. Secrets marcados como "Configurado en GitHub" en inventario.
- 2026-03-07: **Corrección de error de despliegue:** Se elimina línea `route = { pattern = "worker-uno.pages.dev", zone_name = "pages.dev" }` de `wrangler.toml` debido a error `Could not find zone for 'pages.dev'`. Configuración `route` removida completamente del entorno `dev`.

## 10. Archivos de configuración creados

| Archivo | Finalidad | Estado |
|---------|-----------|--------|
| .github/workflows/deploy.yml | CI/CD para Cloudflare | Creado |
| wrangler.toml | Configuración de Wrangler | Creado |
| package.json | Dependencias y scripts | Creado |
| tsconfig.json | Configuración TypeScript | Creado |
| src/index.ts | Worker entry point | Creado |
| .gitignore | Exclusiones de versionado | Creado |
