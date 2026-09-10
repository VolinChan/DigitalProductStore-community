# Más allá de conectar la API: mi investigación del flujo de inventario a documento tributario

[English](relbase-integration.md) · [中文](relbase-integration.zh-CN.md) · [El proyecto](../readme_es_cl.md)

**Notas de desarrollo de Plexoria · 10 de septiembre de 2026**

Al integrar RelBase con Plexoria, necesitaba conectar un flujo concreto: crear una nota de venta para comprometer stock cuando el cliente hace un pedido y, después de confirmar el pago, emitir una boleta o factura desde esa misma nota. El inventario ya estaba comprometido; la emisión no debía descontarlo otra vez, y los importes del despacho y del pago tenían que coincidir.

La creación de la nota funcionaba. El problema apareció al convertirla. Al investigar ese paso, también revisé cómo incorporábamos el despacho, dónde se definía si los montos incluían IVA y cuándo era seguro reintentar una solicitud. Estas notas recogen ese trabajo en la implementación privada Pro.

## Conseguir una reproducción clara

El comportamiento era difícil de conciliar: al referenciar la nota de origen sin enviar líneas de productos, la API pedía productos; al agregarlos, otra validación indicaba que esa conversión no podía incluirlos.

Reuní las diferencias entre ambas solicitudes, el estado de la nota y los identificadores de correlación para que soporte pudiera revisarlos. Una prueba controlada con el procedimiento que nos indicaron produjo la misma validación de detalle. Por eso pedí que el equipo técnico revisara la ruta de conversión que realmente se estaba ejecutando.

No opté por emitir un documento independiente con productos, omitiendo la nota de origen. Esa nota ya había comprometido inventario. Aunque la emisión independiente resultara exitosa, podía dejar un segundo descuento de stock y una nota sin vincular.

La revisión técnica posterior permitió precisar el comportamiento que requería un ajuste y los requisitos de los montos de origen. Con eso pudimos definir mejor el contrato de integración y las comprobaciones de la siguiente prueba.

## El despacho sí tenía una omisión local, pero era otro problema

Durante la investigación, un colega comparó un pedido con su nota de venta y observó que el despacho estaba en el pedido, pero no en la nota. Era una parte de nuestro propio flujo que había que completar.

Si el documento tributario hereda el detalle, el despacho cobrado debe estar incluido al crear la nota. Lo incorporé como un cargo del documento, que el adaptador de RelBase convierte en un ítem de servicio sin manejo de inventario. El despacho gratuito no agrega una línea. Así, productos y despacho participan en el total, mientras que las comprobaciones y los descuentos de stock siguen considerando solamente la mercadería.

Encontrar esa omisión no demostraba que explicara la validación del detalle. Mantuve la reproducción de la conversión separada y avancé con la corrección local de los importes mientras continuaba la revisión con el proveedor. Tampoco podía asumir que un cambio de código completaría automáticamente las notas que ya existían.

## Revisar si realmente se puede reintentar

Que la API mencione una cabecera de idempotencia a nivel general no basta para confirmar que un recurso de documentos proteja contra repeticiones. Después de verificar esa garantía con soporte, incorporé un registro persistente para proteger los envíos desde nuestra aplicación.

Antes de enviar una solicitud de creación, el sistema registra el intento para la conexión con el proveedor y el comando de negocio correspondiente. Otro proceso, un reinicio del servicio o una acción repetida no pueden volver a enviar ese mismo comando sin más. Las escrituras de documentos tampoco utilizan los reenvíos automáticos que un cliente genérico podría hacer ante fallos de autenticación o redirecciones.

Hay un costo: si el proceso se detiene después de registrar el intento, pero antes de enviar la solicitud, la operación puede requerir una revisión para continuar. Esto no resuelve por completo la ejecución «exactamente una vez» entre sistemas. Acepté esa limitación porque detenerse a aclarar un resultado incierto es más controlable que repetir una operación de inventario o emisión.

## Definir los montos en la nota de origen

La regla aclarada para la conversión a boleta exige que la nota de origen tenga montos brutos, con IVA incluido. La conversión adopta el modo de importes de esa nota.

Plexoria ya creaba las notas con precios brutos. El ajuste consistió en dejar de indicar nuevamente ese modo al convertir, manteniendo las validaciones entre líneas, cargos y total. Un parámetro de conversión no puede corregir una nota antigua cuyo despacho falta o cuyos montos están expresados de otra manera.

Mantuve estos detalles específicos del proveedor dentro del adaptador. El checkout y los pedidos siguen trabajando con productos, cargos de despacho y comandos de negocio genéricos. No quiero que cada cambio en los campos de un proveedor obligue a reescribir el flujo de compra.

## Cómo comprobé los cambios

La simulación local cubre 12 combinaciones: boleta o factura, despacho gratuito o dos importes de despacho cobrado, y una o tres unidades de producto. El proveedor simulado calcula la conversión a partir de las líneas que recibió al crear la nota. No devuelve simplemente el total que la prueba espera encontrar.

Las pruebas de condiciones de carrera del backend con PostgreSQL 14 y Redis 7, junto con la regresión de publicación, pasaron. Esas pruebas pertenecen a Pro; la comunidad no incluye ese código de backend. La incorporación completa del despacho, la protección de envíos y el ajuste del modo de importes ya están desplegados.

A la fecha de esta nota, la conversión externa actualizada todavía no ha completado la validación de punta a punta en producción. Mantengo suspendidos los reintentos controlados hasta recibir la confirmación de disponibilidad y revisar la nota elegida para la prueba.

La siguiente comprobación no se limita a obtener una respuesta exitosa: el documento debe quedar vinculado a su nota, el total y el tratamiento del pago deben coincidir, el estado de origen debe actualizarse y el stock de mercadería no debe disminuir otra vez. El movimiento de cantidad cero descrito por el proveedor también debe distinguirse de un descuento real.

Esta investigación hizo más concretos mis criterios de aceptación: comprobar que la misma transacción sigue siendo coherente entre los sistemas involucrados. Iré agregando aquí los resultados de las próximas pruebas de integración.
