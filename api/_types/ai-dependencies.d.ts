/**
 * Declaraciones ambientales para las dependencias OPCIONALES de IA.
 *
 * `tesseract.js` se carga con `import()` dinámico y NO está instalado: el
 * proveedor activo se elige con `AI_PROVIDER` y el valor por defecto
 * (`MOCK`) no lo necesita.
 *
 * `@google-cloud/vision` sí está en `package.json`, pero aquí se declara de
 * forma laxa (`any`) porque solo se usan cuatro métodos y su tipado real arrastra
 * los tipos generados de protobuf/gRPC, que chocan con las formas mínimas que
 * consume `ai-provider.ts`.
 *
 * Sin estos stubs, `tsc` falla al compilar `api/`. Los stubs son deliberadamente
 * laxos para poder tipar callbacks sin declarar toda la librería. Ver hallazgo
 * AI-01 en docs/AUDITORIA_SEGURIDAD.md.
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
