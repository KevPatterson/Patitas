# Instalación de Dependencias de IA

Este proyecto requiere instalar las siguientes dependencias para el sistema de IA.

## Dependencias Requeridas

### Para OCR con Tesseract (Gratuito, sin límites)

```bash
npm install tesseract.js
```

### Para Computer Vision con Google Cloud (Gratuito hasta 1000 req/mes)

```bash
npm install @google-cloud/vision
```

### Opcional: Sharp para optimización de imágenes

```bash
npm install sharp
```

## Instalación Completa

Ejecuta este comando para instalar todas las dependencias de IA:

```bash
npm install tesseract.js @google-cloud/vision
```

## Verificación

Después de instalar, verifica que las dependencias estén en `package.json`:

```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0",
    "@google-cloud/vision": "^4.0.0"
  }
}
```

## Notas

- **Tesseract.js**: Funciona out-of-the-box, no requiere configuración adicional
- **Google Cloud Vision**: Requiere crear Service Account y configurar `GOOGLE_APPLICATION_CREDENTIALS_JSON`

Ver [docs/CONFIGURACION_IA_GRATUITA.md](./docs/CONFIGURACION_IA_GRATUITA.md) para instrucciones completas de configuración.

## Problemas de Instalación

Si tienes problemas de red durante la instalación:

1. Intenta instalar una dependencia a la vez
2. Verifica tu conexión a internet
3. Si estás detrás de un proxy, configúralo en npm

```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

4. Limpia el cache de npm si es necesario:

```bash
npm cache clean --force
```

5. Reintenta la instalación:

```bash
npm install tesseract.js
npm install @google-cloud/vision
```
