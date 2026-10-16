/**
 * Declaraciones ambientales para las dependencias OPCIONALES de IA.
 *
 * `tesseract.js` y `@google-cloud/vision` se cargan con `import()` dinámico
 * dentro de `api/_lib/ai-provider.ts` y NO están instaladas: el proveedor
 * activo se elige con la variable `AI_PROVIDER` y el valor por defecto
 * (`TESSERACT`) no es funcional sin instalar el paquete.
 *
 * Sin estos stubs, `tsc` falla con TS2307 sobre `api/` y no se puede verificar
 * nada más del backend. No se instalan solo para satisfacer al compilador:
 * `@google-cloud/vision` arrastra gRPC y cientos de dependencias.
 *
 * Los stubs son deliberadamente laxos (`any`) para poder tipar callbacks sin
 * declarar toda la librería. Ver hallazgo AI-01 en docs/AUDITORIA_SEGURIDAD.md.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'tesseract.js' {
  /** Mensaje de progreso que emite Tesseract por el logger. */
  export interface LoggerMessage {
    status?: string;
    progress?: number;
    userJobId?: string;
    jobId?: string;
    workerId?: string;
  }

  export const createWorker: any;
  export const recognize: any;
}

declare module '@google-cloud/vision' {
  export const ImageAnnotatorClient: any;
  export const ImageAnnotatorClientV1: any;
}
