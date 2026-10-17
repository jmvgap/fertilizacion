# Calculadora de Fertilización

Web app instalable en el celular que funciona sin conexión. Este primer módulo, **Distribución**, sirve para el ensayo de distribución transversal de fertilizadoras con bandejas: superposición de pasadas, coeficiente de variación (CV) según el ancho de trabajo y dosis.

**Usarla:** https://jmvgap.github.io/fertilizacion/. Desde Chrome en Android: menú ⋮ → *Agregar a la pantalla principal*.

## Pantallas
- **Ensayo:** datos, cantidad y distancia entre cajas (de centro a centro), boca de caja y CV aceptable. Permite guardar y abrir ensayos y exportarlos o importarlos en CSV.
- **Cajas:** carga de pesos, con el perfil de la pasada dibujándose al mismo tiempo. Una caja vacía se interpola; un 0 es un dato.
- **Pasadas:** deslizador de ancho de trabajo y tres pasadas (roja, verde y azul). La central tapa a las otras y el aporte de las demás sube en amarillo. Muestra el CV y la dosis media.
- **Curva CV:** CV según el ancho, en modo continuo y alternado, con los rangos de ancho aceptables. Las mitades del alternado son opcionales.
- **Dosis:** dosis del ensayo en kg/ha, calibración por caudal (kg/ha = kg/min × 600 ÷ (km/h × m)) y caudal necesario para una dosis.

## Cómo calcula
- En cada punto suma **todas** las pasadas que lo alcanzan, no solo las vecinas, así que vale para cualquier ancho de trabajo.
- El CV se calcula sobre **un ciclo completo**: un ancho en continuo y dos en alternado. Usa el desvío estándar muestral (n−1).
- Los anchos que no son múltiplos de la distancia entre cajas se resuelven interpolando linealmente entre cajas.
- [`pruebas.html`](pruebas.html) verifica el motor contra una simulación independiente de 60 pasadas.

## Autoría
**Ing. Agr. Juan Manuel Vázquez**
Departamento de Tecnología, Universidad Nacional de Luján · Facultad de Ciencias Agrarias y Forestales, Universidad Nacional de La Plata.

Desarrollo personal con fines académicos y de extensión. No es una publicación oficial de dichas instituciones.

### Antecedente
Basada en la aplicación FERTICALC (2016), diseñada por Ing. Agr. Roberto Balbuena e Ing. Agr. Juan Manuel Vázquez (Mecanización Agraria, FCAyF–UNLP) y desarrollada por Lic. Nicolás Carlini e Ing. Marcelo Taffarel. Esta versión fue reescrita por completo, con un nuevo método de cálculo de superposición y CV de ciclo completo.

## Licencia
Software libre bajo la [GNU GPL versión 3 o posterior](LICENSE). Podés usarlo, copiarlo y modificarlo. Si distribuís una versión modificada, tiene que mantenerse libre bajo la misma licencia. Se ofrece sin garantía.

## Para desarrollo
- La app no necesita compilación: alcanza con servir la carpeta con cualquier servidor web estático.
- Archivos:
  - `js/motor.js`: cálculos.
  - `js/graficos.js`: gráficos SVG.
  - `js/app.js`: pantallas.
  - `js/catalogo.js`: catálogo de fertilizantes compartido con los módulos futuros.
  - `js/ejemplos.js`: ensayo de ejemplo con datos **inventados**.
  - `sw.js` y `manifest.webmanifest`: instalación y funcionamiento sin conexión.
- Al publicar cambios, subir el número de `VERSION` en `sw.js` para que los celulares descarguen la versión nueva.
