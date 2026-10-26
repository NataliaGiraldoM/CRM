# Orbit — Etapa 2: catálogo y clientes compartidos

Esta entrega contiene el proyecto completo actualizado, incluidos los roles, las sesiones, el diseño de auditoría y el selector de idioma de la etapa anterior.

## Qué está implementado

- Una sola empresa por instalación/base de datos: todas las cuentas activas de esta instalación consultan los mismos clientes y el catálogo. No existe aislamiento entre múltiples empresas.
- Se conserva owner_user_id en clientes como usuario creador/responsable; ya no se utiliza para ocultar clientes a los otros usuarios de la instalación.
- Solo los administradores crean, cambian estado o eliminan clientes. Todos los administradores pueden hacerlo sobre los clientes compartidos y el actor real queda en auditoría.
- Catálogo de productos y servicios con código único, nombre, descripción, categoría, estado, moneda COP, precio base, tratamiento y tarifa de IVA.
- Todos los usuarios activos consultan catálogo; solo admin crea y edita.
- No se borran productos: se desactivan para conservar referencias e historial.
- Motivo obligatorio en las creaciones y cambios del catálogo.
- Auditoría de antes/después para cambios de precio, impuesto y demás datos.
- Control de versión para evitar sobrescribir la edición de otro administrador: ante conflicto, actualizar y revisar antes de guardar nuevamente.
- Búsqueda por código/nombre/categoría y filtros por tipo/estado.
- El importe de IVA y precio final se calculan en el backend con aritmética decimal de PostgreSQL, redondeando el IVA a dos decimales por unidad.

## Paso 1. Conserva un respaldo

Guarda una copia del proyecto y un respaldo de tu PostgreSQL antes de migrar. La nueva migración crea products; no elimina los clientes ni cambia sus propietarios. El cambio de visibilidad de clientes está en el backend.

Al actualizar autorizas a TODOS los usuarios activos de esta instalación a consultar TODOS sus clientes. Esta configuración es para una sola empresa. No utilices la misma instalación para empresas independientes.

## Paso 2. Copia los archivos

Extrae el ZIP. Puedes abrir el proyecto Orbit_Etapa2 por separado y copiar allí tu backend/.env privado.

Si actualizas tu carpeta vinculada al repositorio, copia el contenido del proyecto y combina/reemplaza los archivos. Conserva tu .git y tu backend/.env. No viene ningún .env con credenciales dentro del ZIP. No subas ese archivo al repositorio.

## Paso 3. Instala dependencias

Desde la raíz:

```bash
npm ci
```

Desde otra terminal, en backend:

```bash
npm ci
npm run build
npm run db:migrate
```

El comando de migración consulta orbit_migrations y aplica solo las migraciones pendientes. Si ya aplicaste la primera etapa, debe ejecutar 002_catalog y después mostrar Migration ready. No repitas manualmente 001_access.sql ni recrees las tablas.

Si la primera etapa nunca se aplicó, el mismo comando aplica 001_access y 002_catalog, en orden. Requiere que ya exista el esquema original users/customers/customer_status_history.

No es necesario ejecutar admin:bootstrap otra vez si ya tienes tu administrador.

## Paso 4. Inicia Orbit

En backend:

```bash
npm run dev
```

En otra terminal, desde la raíz:

```bash
npm run dev
```

Mantén ambos procesos encendidos y abre la URL Local que indique Vite. Si tenías la versión anterior abierta, recarga la página y vuelve a iniciar sesión si hace falta.

## Paso 5. Prueba el catálogo

1. Entra como administrador y abre Catálogo desde el header (icono de caja).
2. Pulsa Agregar producto.
3. Código de ejemplo: PROD-001. El código admite letras, números, guion y guion bajo; se normaliza a mayúsculas y no se puede repetir.
4. Completa nombre, categoría, tipo y precio base en COP, sin incluir IVA.
5. Elige tratamiento: Gravado, Exento o Excluido. La aplicación no clasifica automáticamente productos según la legislación.
6. Ingresa una tarifa explícita si corresponde a Gravado. Exento/Excluido usan cero, conservando la diferencia de tratamiento.
7. Si es servicio, no puede controlar inventario. El indicador de inventario en esta entrega solo configura si el producto necesitará existencias; todavía no almacena ni mueve cantidades.
8. Escribe el motivo y guarda.
9. Edita el precio o la tarifa, indica otro motivo y guarda.
10. Abre Auditoría y busca los eventos de la entidad products: deben conservar antes/después y responsable.
11. Cambia el estado a Inactivo para retirar un elemento del catálogo operativo sin eliminarlo. Puedes reactivarlo con otra edición y motivo.
12. En una ventana privada entra como Consulta: debe ver clientes compartidos y catálogo, sin botón para agregar o editar. Los endpoints también bloquean escrituras.

Ejemplo exclusivamente de prueba del cálculo: precio base 100.05 y tarifa configurada 19 producen IVA 19.01 y precio final 119.06. Este ejemplo no atribuye una tarifa legal a ningún producto real.

## Condiciones tributarias y próximos pasos

Los tratamientos y tasas son configurables y deben verificarse para cada producto antes de uso real. Esta entrega no emite facturas electrónicas, no determina obligaciones fiscales de la empresa y no genera reportes tributarios. La fórmula actual corresponde a un precio por unidad y un único IVA; la etapa de ventas definirá cantidades, redondeos por línea y totales, además del precio e IVA históricos de cada venta.

El catálogo todavía NO incluye entradas/salidas, cantidades, reservas o alertas de inventario. La siguiente etapa será inventario por movimientos y después ventas conectadas a esos movimientos. No hay un campo de cantidad editable directamente en este catálogo.

## Qué se verificó

- Compilación TypeScript y Vite del frontend y TypeScript del backend.
- Integración HTTP con PostgreSQL embebido PGlite: permisos, activación/desactivación, sesiones, auditoría, clientes compartidos, creación/edición de catálogo, código duplicado, validaciones, cálculo decimal, conflictos de versión y desactivación.
- Renderizado estático del catálogo en español para admin/consulta y visibilidad de acciones.
- No se usaron credenciales ni se modificó tu PostgreSQL de Render. No se probó un despliegue real ni interacción visual en navegador.

Para repetir las pruebas sin conectar a Render, compila backend; luego en tests ejecuta npm install y npm test.

## Despliegue

Antes de desplegar el backend en Render, ejecuta db:migrate contra la base correspondiente. Si el backend es desplegado por build, usa npm ci && npm run build y npm start como antes.

El frontend usa /api mediante el proxy de Vite en desarrollo. Un despliegue del frontend necesita su propia conexión/ruta /api al backend; el proxy de Vite no se incluye automáticamente en producción.
