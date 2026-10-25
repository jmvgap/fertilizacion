# Calculadora de Fertilización

Web app instalable en el celular que funciona sin conexión. El módulo **Distribución** sirve para el ensayo de distribución transversal de fertilizadoras con bandejas: superposición de pasadas, coeficiente de variación (CV) según el ancho de trabajo y dosis.

**Usarla:** https://jmvgap.github.io/fertilizacion/. Desde Chrome en Android: menú ⋮ → *Agregar a la pantalla principal*.

## Módulo Distribución
- **Ensayo:** datos, cantidad y distancia entre cajas (de centro a centro), boca de caja. CV en colores: verde hasta 15 %, amarillo hasta 25 % y rojo arriba. Permite guardar y abrir ensayos y exportarlos o importarlos en CSV.
- **Cajas:** carga de pesos en una fila horizontal que se desliza de costado, como las cajas en el campo, con la barra de cada caja sobre su casilla. Una caja vacía se interpola; un 0 es un dato.
- **Pasadas:** deslizador de ancho de trabajo y tres pasadas (roja, verde y azul). Capas: en amarillo la suma de todas las pasadas, delante las vecinas completas y adelante de todo la central. Tocando una barra se ve el aporte de cada pasada. Muestra el CV y la dosis media.
- **Curva CV:** CV según el ancho, en modo continuo y alternado, con los rangos de ancho en verde y en amarillo. Las mitades del alternado son opcionales.
- **Dosis:** dosis del ensayo en kg/ha, calibración por caudal (kg/ha = kg/min × 600 ÷ (km/h × m)) y caudal necesario para una dosis.

## Módulo Recomendación y costos (antes app Ferti)
- **Lote:** cultivo (maíz, soja o trigo), rendimiento esperado, N de nitratos 0–60 cm, P Bray, arcilla, densidad aparente y zona (norte o sur de la Pampa Deprimida).
- **Dosis N y P:**
  - N por umbral.
  - P con dos dosis: **suficiencia** (lleva el P al nivel crítico para esta campaña) y **construcción y mantenimiento** (además repone lo que exporta la cosecha).
  - Todo en kg de elemento, con el equivalente en P₂O₅.
- **Fertilizantes:** catálogo compartido con grado y grado equivalente, precios en U$S/t guardados con su fecha (el botón "Actualizar precios" descarga los de [`precios.json`](precios.json), que se edita desde GitHub), y costo por kg de N, de P y de P₂O₅.
- **Más económica:** prueba todas las combinaciones de uno o dos productos y ordena por costo.

## Cómo calcula
- En cada punto suma **todas** las pasadas que lo alcanzan, no solo las vecinas, así que vale para cualquier ancho de trabajo.
- El CV se calcula sobre **un ciclo completo**: un ancho en continuo y dos en alternado. Usa el desvío estándar muestral (n−1).
- Los anchos que no son múltiplos de la distancia entre cajas se resuelven interpolando linealmente entre cajas.
- [`pruebas.html`](pruebas.html) verifica el motor contra una simulación independiente de 60 pasadas.
- **Recomendación:**
  - N = umbral − N de nitratos (0–60 cm).
  - Dosis equivalente de P = 2 × densidad aparente ÷ b, con b = 0,45369 + 0,00356·Bray + 0,16245·zona − 0,00344·arcilla. Zona: 1 = norte, 0 = sur. Es el modelo 2 de Rubio et al. (2008), *Soil Sci. Soc. Am. J.* 72:1721.
  - Niveles críticos de P Bray: maíz 12,5, soja 14,3 y trigo 19 ppm (Sucunza et al. 2018, *Eur. J. Agron.* 96:87).
  - P exportado: maíz 3,0, soja 6,7 y trigo 3,75 kg P/t (tablas del IPNI).

## Autoría
**Ing. Agr. Juan Manuel Vázquez**
Departamento de Tecnología, Universidad Nacional de Luján · Facultad de Ciencias Agrarias y Forestales, Universidad Nacional de La Plata.

Desarrollo personal con fines académicos y de extensión. No es una publicación oficial de dichas instituciones.

### Antecedente
Basada en la aplicación FERTICALC (2016). Idea y prototipo original (App Inventor): Ing. Agr. Juan Manuel Vázquez, en colaboración con el Ing. Agr. Roberto Balbuena (Mecanización Agraria, FCAyF–UNLP). Versión Android desarrollada por Lic. Nicolás Carlini e Ing. Marcelo Taffarel. Esta versión fue reescrita por completo, con un nuevo método de cálculo de superposición y CV de ciclo completo.

## Licencia
Software libre bajo la [GNU GPL versión 3 o posterior](LICENSE). Podés usarlo, copiarlo y modificarlo. Si distribuís una versión modificada, tiene que mantenerse libre bajo la misma licencia. Se ofrece sin garantía.

## Para desarrollo
- La app no necesita compilación: alcanza con servir la carpeta con cualquier servidor web estático.
- Archivos:
  - `js/motor.js`: cálculos.
  - `js/graficos.js`: gráficos SVG.
  - `js/app.js`: pantallas del módulo Distribución y funciones compartidas.
  - `js/recomendacion.js`: cálculos del módulo Recomendación y costos.
  - `js/app-reco.js`: pantallas del módulo Recomendación y costos.
  - `js/catalogo.js`: catálogo de fertilizantes compartido con los módulos futuros.
  - `js/ejemplos.js`: ensayo de ejemplo con datos **inventados**.
  - `sw.js` y `manifest.webmanifest`: instalación y funcionamiento sin conexión.
- Al publicar cambios, subir el número de `VERSION` en `sw.js` para que los celulares descarguen la versión nueva.
