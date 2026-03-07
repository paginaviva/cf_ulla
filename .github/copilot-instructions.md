# Instrucciones del proyecto para GitHub Copilot

## Finalidad

Estas instrucciones alinean GitHub Copilot con la gobernanza del proyecto y con el agente orquestador.

## Reglas obligatorias

1. No asumir nombres de recursos Cloudflare, dominios, identificadores, bindings ni variables no documentadas.
2. No fijar en código valores sensibles, `account_id`, direcciones propias ni credenciales.
3. No escribir secretos en el repositorio. Los secretos de despliegue deben gestionarse mediante GitHub Secrets.
4. Escribir el código en inglés y la documentación del proyecto en español de España.
5. Priorizar TypeScript cuando proceda.
6. Comprobar si una tarea afecta a `.github/inventario_recursos.md` y actualizarlo si corresponde.
7. Antes de dar por bueno un cambio, exigir evidencia de lint, typecheck y tests cuando existan.
8. No proponer commits finales sin identificador proporcionado por el usuario.

## Inventario operativo

`.github/inventario_recursos.md` es la fuente de verdad operativa del proyecto para Cloudflare y CI.

Si una sugerencia afecta a:

- Wrangler;
- recursos Cloudflare;
- bindings;
- variables de entorno;
- secretos;
- despliegue;
- CI/CD;

la sugerencia debe revisarse frente a `.github/inventario_recursos.md`.

## Arquitectura agéntica
- `.claude/agente orquestador.md`: coordina, valida y decide aceptación o bloqueo.
- `.claude/natural-language-interpreter.md`: interpreta instrucciones del usuario.
- `.claude/cloudflare-wrangler.md`: ejecuta cambios de Wrangler y despliegue.
- `.claude/code-validator.md`: valida calidad y cumplimiento de reglas.
