/**
 * wf-api-inmo - Cloudflare Workflow para procesamiento de URLs inmobiliarias
 *
 * Workflow durable que:
 * - Obtiene contenido HTTP de una URL
 * - Extrae datos estructurados mediante OpenAI API
 * - Almacena resultados en R2
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";

/**
 * Parámetros del workflow
 */
export interface WorkflowParams {
  url: string;
  executionId: string;
}

/**
 * Datos extraídos de un inmueble
 */
interface ExtractedData {
  tipo?: string;
  operacion?: string;
  precio?: number;
  habitaciones?: number;
  banos?: number;
  metrosCuadrados?: number;
  direccion?: string;
  descripcion?: string;
  caracteristicas?: string[];
  imagenes?: string[];
}

/**
 * Resultado final del workflow
 */
interface WorkflowResult {
  executionId: string;
  url: string;
  timestamp: string;
  status: "completed" | "failed" | "running";
  extractedData?: ExtractedData;
  error?: string;
}

/**
 * Environment interface para el workflow
 */
interface Env {
  DIR_API_INMO: R2Bucket;
  SECRETS_API_INMO: KVNamespace;
  ENVIRONMENT: string;
  LOG_LEVEL: string;
}

/**
 * Clase principal del Workflow
 */
export class WfApiInmo extends WorkflowEntrypoint<Env, WorkflowParams> {
  /**
   * Función principal de ejecución del workflow
   */
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { url, executionId } = event.payload;
    const timestamp = new Date().toISOString();

    console.log(`[Workflow] Iniciando ejecución ${executionId} para URL: ${url}`);

    let result: WorkflowResult = {
      executionId,
      url,
      timestamp,
      status: "running"
    };

    try {
      // Paso 1: Obtener contenido HTTP
      const htmlContent = await step.do("Obtener contenido HTTP", async () => {
        console.log(`[Paso 1] Obteniendo contenido de ${url}`);
        const response = await fetch(url, {
          headers: {
            "User-Agent": "ApiInmoBot/1.0"
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      });

      // Paso 2: Preparar contenido para OpenAI
      const preparedContent = await step.do("Preparar contenido", async () => {
        console.log("[Paso 2] Preparando contenido para extracción");
        // Limitar tamaño del contenido (max 100KB)
        const maxLength = 100 * 1024;
        return htmlContent.length > maxLength
          ? htmlContent.substring(0, maxLength)
          : htmlContent;
      });

      // Paso 3: Llamar a API de OpenAI
      const extractedData = await step.do("Extraer datos con OpenAI", async () => {
        console.log("[Paso 3] Llamando a OpenAI API");
        const openaiKey = await this.env.SECRETS_API_INMO.get("OPENAI_API_KEY");

        if (!openaiKey) {
          throw new Error("OPENAI_API_KEY no configurada");
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `Eres un extractor de datos inmobiliarios. Analiza el contenido HTML y extrae la información del inmueble en formato JSON.
                
Campos a extraer:
- tipo: "piso" | "casa" | "apartamento" | "studio" | "terreno" | "local"
- operacion: "venta" | "alquiler"
- precio: número en euros
- habitaciones: número de dormitorios
- banos: número de baños
- metrosCuadrados: superficie en m²
- direccion: dirección completa
- descripcion: descripción del inmueble
- caracteristicas: array de características (ascensor, parking, piscina, etc.)
- imagenes: array de URLs de imágenes

Responde SOLO con el JSON, sin texto adicional.`
              },
              {
                role: "user",
                content: `Extrae los datos del inmueble de este contenido HTML:\n\n${preparedContent}`
              }
            ],
            temperature: 0.1,
            max_tokens: 2000
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json() as { choices: [{ message: { content: string } }] };
        const content = data.choices[0]?.message?.content || "{}";

        // Parsear JSON de la respuesta
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No se pudo extraer JSON válido de la respuesta");
        }

        return JSON.parse(jsonMatch[0]) as ExtractedData;
      });

      // Paso 4: Generar resultado final
      result = {
        executionId,
        url,
        timestamp,
        status: "completed",
        extractedData
      };

      // Paso 5: Guardar en R2
      await step.do("Guardar resultado en R2", async () => {
        console.log("[Paso 5] Guardando resultado en R2");
        await this.env.DIR_API_INMO.put(
          `dir-api-inmo/${executionId}.json`,
          JSON.stringify(result),
          {
            customMetadata: {
              executionId,
              url,
              timestamp,
              status: "completed"
            }
          }
        );
      });

      console.log(`[Workflow] Completado exitosamente: ${executionId}`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      console.error(`[Workflow] Error en ${executionId}:`, errorMessage);

      result = {
        executionId,
        url,
        timestamp,
        status: "failed",
        error: errorMessage
      };

      // Guardar estado de error en R2
      await step.do("Guardar error en R2", async () => {
        await this.env.DIR_API_INMO.put(
          `dir-api-inmo/${executionId}.json`,
          JSON.stringify(result),
          {
            customMetadata: {
              executionId,
              url,
              timestamp,
              status: "failed"
            }
          }
        );
      });

      throw error;
    }
  }
}
