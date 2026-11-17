# Informe de Ingresos y Gastos de Fiesta de Navidad Jobos Campers Park

Aplicación web moderna (Móvil, Tableta y Computadora) para la administración y transparencia de los fondos (Depósitos por ATH Móvil / Cash y Gastos pagados con recibo obligatorio) de la Fiesta de Navidad de **Jobos Campers Park**.

## Características principales
- **Compresión de imágenes en el navegador (Sin tarjeta en Firebase)**: Las fotos de los recibos de ATH Móvil y facturas de gastos se comprimen automáticamente en el navegador y se guardan directo en **Cloud Firestore** (`fiestajoboscampers`).
- **Lector Automático de Recibos ATH Móvil (OCR)**: Detecta el monto y el formato `Nombre - Camper # - # personas` (ejemplo: `Darinel Villegas - Camper 30 - 3`). Si está completo puede guardarlo automáticamente; si le falta algún dato permite completarlo manualmente antes de guardar.
- **Consola de Administración protegida por PIN (`1270`)**: Permite entrar depósitos (automáticos o manuales), registrar gastos (con imagen de recibo obligatoria) y editar o eliminar registros existentes.
- **Visor de Recibos integrado**: Todos los gastos (y los depósitos con recibo) muestran un botón `📷 Ver Recibo` que abre el comprobante en pantalla con opción de zoom y descarga.
