# Inventario de recursos (EJEMPLO)

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

- Nombre del proyecto: **mi-proyecto-cloudflare**
- Finalidad: **API REST para gestión de usuarios**
- Entorno principal de trabajo: **GitHub Codespaces, GitHub Copilot y Claude Code**
- Lenguaje base previsto: **TypeScript**
- Entornos de despliegue: **dev, staging, production**

## 2. Recursos Cloudflare

| Tipo | Nombre | Estado | Uso | Observaciones |
|------|--------|--------|-----|---------------|
| Worker | api-usuarios | Creado | API principal | Desplegado en producción |
| Worker | api-usuarios-dev | Eliminado | Pruebas temporales | Eliminado tras validación |
| KV | cache-sesiones | Creado | Caché de sesiones | TTL 24h |
| D1 | db-usuarios | Pendiente | Base de datos principal | Pendiente de migración |
| R2 | uploads-bucket | Pendiente | Almacenamiento de archivos | Solo crear si el usuario lo define |
| Queue | cola-notificaciones | Pendiente | Notificaciones asíncronas | Solo crear si el usuario lo define |

## 3. Wrangler y despliegue

- Uso de Cloudflare Wrangler: **Sí**
- Archivo de configuración: **wrangler.toml (creado)**
- Cuenta Cloudflare: **ver 5. Secrets y credenciales**
- `account_id`: **No documentado y no debe fijarse sin validación**
- Método de autenticación para despliegue: **GitHub Actions + cloudflare/wrangler-action@v3**

## 4. Bindings y variables de entorno

| Clave o binding | Tipo | Estado | Ubicación | Observaciones |
|-----------------|------|--------|-----------|---------------|
| CACHE_KV | KV Namespace | Creado | wrangler.toml | Para caché de sesiones |
| USER_DB | D1 Database | Pendiente | wrangler.toml | Base de datos de usuarios |
| API_KEY_EXTERNA | Variable de entorno | Pendiente | GitHub Secrets | Clave de API de terceros |

## 5. Secrets y credenciales

| Nombre lógico | Sistema de gestión | Estado | Observaciones |
|---------------|--------------------|--------|---------------|
| CLOUDFLARE_API_TOKEN | GitHub Secrets | Configurado en GitHub | No documentar valores |
| CLOUDFLARE_ACCOUNT_ID | GitHub Secrets | Configurado en GitHub | No documentar valores |
| DATABASE_URL | GitHub Secrets | Pendiente | Conexión a base de datos externa |
| API_KEY_EXTERNA | GitHub Secrets | Pendiente | Clave de servicio de terceros |

## 6. GitHub y CI/CD

- Repositorio GitHub: **mi-organizacion/mi-proyecto-cloudflare**
- GitHub Actions: **Configurado (deploy.yml)**
- GitHub Secrets requeridos para Cloudflare: **CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID**
- Integración con GitHub Copilot: **Sí**
- Integración con GitHub Codespaces: **Sí**

## 7. Restricciones operativas confirmadas

- El agente orquestador es **puramente lógico de coordinación**.
- La entrada principal es el **chat del entorno de desarrollo** con instrucciones del usuario.
- El agente orquestador debe **validar, advertir, bloquear, rechazar, exigir evidencias y registrar incumplimientos**.
- No debe mantenerse memoria persistente fuera del trabajo corriente.

## 8. Vacíos pendientes de confirmación

- Dominio personalizado para producción (actualmente usa workers.dev)
- Estrategia de pruebas del proyecto (unitarias, integración, E2E)
- Configuración de CORS para orígenes permitidos
- Límites de rate limiting para la API

## 9. Historial operativo

- 2026-03-06: Se crea la plantilla inicial del agente orquestador, tres agentes ejecutores mínimos y este inventario base.
- 2026-03-07: Se incorpora `cloudflare/wrangler-action@v3`. Se crean archivos de configuración iniciales.
- 2026-03-08: Se crea Worker `api-usuarios` para producción con entorno dev y staging.
- 2026-03-09: Se configura KV Namespace `cache-sesiones` para gestión de sesiones de usuario.

## 10. Archivos de configuración creados

| Archivo | Finalidad | Estado |
|---------|-----------|--------|
| .github/workflows/deploy.yml | CI/CD para Cloudflare | Creado |
| wrangler.toml | Configuración de Wrangler | Creado |
| package.json | Dependencias y scripts | Creado |
| tsconfig.json | Configuración TypeScript | Creado |
| src/index.ts | Worker entry point | Creado |
| .gitignore | Exclusiones de versionado | Creado |
