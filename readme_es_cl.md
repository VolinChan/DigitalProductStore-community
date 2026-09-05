# Plexoria para vender productos físicos en Chile

Una tienda propia pensada para vender productos físicos en Chile: catálogo, stock, cobro, documentos tributarios y despacho en un mismo flujo.

[English](README.md) · [中文](README_zh.md)

**Tienda en funcionamiento:** <https://www.plexoria.cl>

Plexoria une una vitrina rápida y móvil con las herramientas que necesita la operación detrás de cada venta. No se limita a mostrar productos: modela variantes y SKU, vuelve a validar precios y stock al comprar, conserva el detalle histórico del pedido y prepara la coordinación entre pago, inventario, documentos tributarios, despacho y atención al cliente.

Este repositorio contiene la **Community Edition**, una vista previa abierta del frontend. El backend de producción, el panel administrativo y las integraciones comerciales se mantienen en la edición privada **Pro**. Esa separación permite revisar la experiencia de compra sin publicar credenciales, datos de clientes ni reglas internas del negocio.

## Hecho para la realidad del comercio chileno

Vender productos físicos en Chile exige bastante más que levantar un catálogo. La dirección debe entender Región y Comuna; el total debe expresarse en CLP; el costo de despacho depende del destino; cada pago debe quedar conciliado con el pedido; y la operación puede necesitar boleta, factura, bodegas y servicios locales.

Plexoria fue diseñada alrededor de ese recorrido completo:

```text
Catálogo y SKU
      ↓
Carrito y validación en servidor
      ↓
Pedido con precio, dirección y despacho congelados
      ↓
Pago → stock y documento tributario → despacho
      ↓
Seguimiento, notificaciones y operación posventa
```

## Seis ventajas para una pyme que vende productos físicos

### 1. Un catálogo que representa lo que realmente se vende

- Categorías, descripciones enriquecidas, especificaciones estructuradas, contenido multimedia y orden de publicación.
- Variantes y SKU con precio, stock, atributos e imágenes propias.
- Vista previa y controles de publicación para detectar fichas incompletas antes de exponerlas.
- Selección de SKU sincronizada con la foto, el precio, la disponibilidad y la acción de compra.

**Valor para el negocio:** menos consultas por información faltante y menos errores entre la variante que el cliente eligió y la que el equipo debe preparar.

### 2. Un carrito que no confía en datos antiguos

- Carrito para visitantes y clientes registrados, mini carrito y compra directa con **Comprar ahora**.
- Avisos cuando cambia el precio, la disponibilidad o la selección guardada.
- Validación autoritativa en el backend antes de crear el pedido; el navegador no decide el monto final ni el stock disponible.
- Registro inmutable de productos, precios, dirección y cotización de despacho para preservar lo que se acordó al comprar.

**Valor para el negocio:** una base auditable para resolver diferencias y evitar que un carrito desactualizado se convierta silenciosamente en un pedido incorrecto.

### 3. Medios de pago adecuados para Chile

- Transferencia bancaria con carga de comprobante, revisión operativa, registro de abonos y conciliación de pagos parciales.
- Integración de **Mercado Pago Checkout Pro** con preferencia de pago, retorno, webhook e idempotencia.
- Integración de **Webpay Plus** con creación de transacción, retorno seguro y reconciliación.
- El medio de pago queda asociado al pedido, con estados explícitos para pago pendiente, revisión, aprobación o rechazo.

**Valor para el negocio:** el equipo puede ofrecer alternativas conocidas por el comprador chileno sin perder la trazabilidad entre dinero y pedido.

### 4. Despacho calculado con contexto local

- Dirección estructurada por Región y Comuna, además de los datos necesarios para la entrega.
- Tarifas configurables por Comuna o Región, con subsidio y recargo para zonas remotas.
- Cotización histórica guardada en el pedido: un cambio posterior de tarifas no reescribe una venta ya realizada.
- Flujo de cobro adicional cuando la operación necesita corregir una diferencia de despacho.
- Arquitectura preparada para conectores logísticos y seguimiento del pedido.

**Valor para el negocio:** proteger el margen sin esconderle al cliente cómo se forma el costo de despacho.

### 5. Puente entre la tienda, el inventario y la operación tributaria

- Integración controlada con **Relbase** mediante OAuth, mapeo de SKU y proyección de stock por bodega.
- Flujo preparado para nota de venta y documentos tributarios electrónicos, incluida la elección entre boleta y factura.
- Estados y barreras operativas para que un fallo externo no parezca una emisión o sincronización exitosa.
- Conservación del contexto del pedido para investigar diferencias entre la tienda y el sistema de gestión.

**Valor para el negocio:** reducir la doble digitación y avanzar hacia una fuente de stock y documentación coherente, con adopción gradual y verificable.

### 6. Herramientas para operar en equipo

- Roles y permisos detallados, invitación de colaboradores y registro de auditoría.
- Gestión de productos, pedidos, pagos, despachos e integraciones desde el panel Pro.
- Notificaciones dentro de la aplicación y correos transaccionales mediante una cola de salida reintentable.
- Indicadores operativos con cortes horarios de `America/Santiago`.
- Métricas, alertas y tableros con Prometheus y Grafana para la infraestructura comercial.

**Valor para el negocio:** saber quién hizo qué, detectar problemas antes y separar las tareas sin entregar acceso total a cada integrante.

## Una experiencia de compra pensada para convertir

La vitrina pública incluye:

- Diseño que prioriza móviles desde 320 px y navegación adaptada a escritorio.
- Rutas en español de Chile (`es-CL`), precios en CLP y formularios con términos locales.
- Búsqueda, filtros, orden y paginación persistidos en la URL para que el comprador pueda volver o compartir su selección.
- Fichas con galería, contenido multimedia, especificaciones, variantes, precio y stock en contexto.
- Carrito, mini carrito, autenticación, registro, checkout y seguimiento de pedido.
- Menús, diálogos y paneles laterales utilizables con teclado, restauración del foco, reducción de movimiento y errores de formulario localizados.
- Base técnica para SEO, rutas localizadas y metadatos de producto.

La interfaz está respaldada por pruebas Playwright de descubrimiento, compra, accesibilidad y comportamiento adaptable. La Community Edition permite revisar este frontend; los datos y servicios productivos no forman parte del repositorio público.

## Capacidades verificadas y condiciones de salida a producción

Preferimos mostrar el estado real de cada integración. “Implementado” no significa que un comercio pueda omitir la contratación del proveedor, sus credenciales, certificaciones o pruebas con dinero y datos reales.

| Frente | Estado del producto | Antes de habilitarlo en producción |
|---|---|---|
| Transferencia bancaria | Flujo Pro de comprobantes, abonos y revisión implementado | Configurar cuentas, responsables y procedimiento de conciliación del comercio |
| Mercado Pago Checkout Pro | Ciclo Sandbox implementado, incluidos el retorno, el webhook y la idempotencia | Incorporar credenciales productivas y completar pruebas de fallos y una compra controlada con dinero real |
| Webpay Plus | Protocolo principal, retorno seguro y reconciliación implementados | Completar validación formal con Transbank, instalar credenciales productivas y ejecutar un despliegue gradual |
| Relbase | OAuth, sondas controladas, mapeo de SKU, compromiso de stock y flujo tributario desarrollados. El contrato de conversión de una Nota de Venta con stock a DTE confirmado por el proveedor aún no coincide con el comportamiento observado en una prueba controlada del API v2 | Resolver la discrepancia con el equipo técnico del proveedor, ejecutar un piloto y aprobar las reglas con el contador antes de habilitar por etapas la autoridad de stock; la emisión automática de DTE permanece deshabilitada hasta completar estas validaciones |
| Conector logístico MoveUp | Adaptador y pruebas controladas disponibles | Completar pruebas de punta a punta cuando la API del proveedor responda de forma estable; las últimas pruebas externas obtuvieron respuestas HTTP 500/EOF |
| Privacidad y textos legales | Páginas base y controles de consentimiento disponibles | Revisar textos, versiones y obligaciones aplicables con asesoría legal del comercio |

La integración de inventario disminuye desajustes, pero no promete sobreventa cero entre todos los canales: la consistencia final también depende del proveedor externo, del mapeo de SKU y de las reglas operativas de cada bodega.

## Community Edition y edición Pro

| | Community Edition | Pro / implementación comercial |
|---|---|---|
| Objetivo | Revisar, aprender, contribuir y ejecutar una demo de la vitrina | Operar una tienda con backend, administración e integraciones privadas |
| Incluye | Código Next.js, experiencia adaptable y localizada, pruebas E2E y Compose para vista previa | API Go, pedidos, inventario, pagos, documentos tributarios, panel administrativo, observabilidad y reglas de operación |
| Datos y credenciales reales | No | Se configuran en el entorno privado del comercio |
| Infraestructura incluida en el inicio rápido | Solo frontend | Se define según la implementación y el acuerdo comercial |
| Licencia | AGPLv3 | Licencia y soporte comercial por separado |

La Community Edition **no es el backend de producción** ni una promesa de que todas las integraciones estén listas con solo clonar el repositorio. Las credenciales de pago, datos de clientes, reglas de preparación y despacho, certificados y configuración privada nunca deben publicarse en un fork.

## Pruebe la Community Edition

Requisitos: Docker Desktop y Git.

```bash
git clone https://github.com/VolinChan/DigitalProductStore-community.git
cd DigitalProductStore-community
cp .env.community.example .env
docker compose -f docker-compose.community.yml up --build
```

Abra <http://localhost:3000>. Este Compose inicia solamente la vista previa del frontend; no levanta la API de producción, PostgreSQL, Redis, Nginx, Grafana, Prometheus ni medios de pago reales.

Para detenerla:

```bash
docker compose -f docker-compose.community.yml down
```

Para desarrollo local del frontend:

```bash
cd frontend
cp .env.local.example .env.local
npm ci
npm run dev
```

## Actualizador opcional de IP reales de Cloudflare

El repositorio conserva un actualizador reutilizable y sin credenciales para instalaciones que ubican un contenedor Nginx detrás de Cloudflare. Descarga por HTTPS las listas oficiales IPv4 e IPv6, valida la configuración candidata de Nginx, reemplaza el archivo de redes confiables de forma atómica y recarga Nginx solo si la validación termina correctamente. Un timer de systemd lo ejecuta a diario con una demora aleatoria y mantiene la última configuración funcional si falla una descarga, validación o recarga.

```text
nginx/runtime/cloudflare-real-ip.conf                 Línea base pública actual
scripts/update-cloudflare-real-ip.sh                  Actualizador validado
scripts/systemd/plexoria-cloudflare-real-ip.service   Servicio systemd de una ejecución
scripts/systemd/plexoria-cloudflare-real-ip.timer     Timer systemd diario
```

El preview Community de frontend no habilita este componente. Para reutilizarlo en un despliegue propio con Docker y Nginx, monte el directorio host que contiene `cloudflare-real-ip.conf` en `/etc/nginx/runtime` dentro del contenedor, incluya ese archivo desde el contexto `http` de Nginx y ajuste `CLOUDFLARE_REAL_IP_TARGET` y `NGINX_CONTAINER` según su instalación. Confíe en `CF-Connecting-IP` únicamente para conexiones originadas en esas redes oficiales de Cloudflare; no agregue una regla abierta para clientes que lleguen directamente al origen.

## Arquitectura y tecnología

La vista previa pública usa esta arquitectura:

```text
Navegador → vitrina Next.js
```

La plataforma completa incorpora Next.js, React y TypeScript en el frontend; una API en Go con Gin y GORM; PostgreSQL y Redis; y despliegue con Docker Compose, Nginx, Prometheus y Grafana. Los conectores comerciales se aíslan detrás de servicios del backend para que sus fallos no conviertan una respuesta externa en un estado de pedido ambiguo.

Mapa del repositorio Community:

```text
frontend/                              Storefront
docker-compose.community.yml           Preview del frontend
.env.community.example                 Configuración demo sin secretos
nginx/runtime/                         Línea base de redes Cloudflare
scripts/update-cloudflare-real-ip.sh   Actualizador opcional validado
scripts/systemd/                       Servicio y timer opcionales
```

## Seguridad, licencia y contacto

- No suba `.env`, credenciales, llaves privadas, respaldos de base de datos, datos de clientes ni exportaciones reales de productos.
- Use información demo reproducible en issues públicos.
- Reporte vulnerabilidades según [`SECURITY.md`](SECURITY.md) y revise [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de contribuir.

La Community Edition se distribuye bajo [GNU Affero General Public License v3.0](LICENSE). Un despliegue privado sin obligaciones AGPL, soporte, SLA, marca blanca e integraciones a medida requieren un acuerdo comercial independiente.

Si quiere evaluar Plexoria para su comercio, migrar su catálogo o conversar sobre una implementación en Chile, contacte a **[VolinChan en GitHub](https://github.com/VolinChan)**. No publique credenciales, datos de clientes ni antecedentes comerciales sensibles en un issue abierto.
