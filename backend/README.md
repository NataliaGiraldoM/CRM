# Backend ORBIT

Desde esta carpeta: `npm ci`, `npm run build`, `npm run db:migrate`, `npm run dev`.

Configuración en **backend/.env**: `DATABASE_URL`, `JWT_SECRET`, `PORT=5000`. En Render se pueden definir directamente como variables de entorno. El código carga la misma ruta tanto desde src como desde dist; las variables del entorno tienen prioridad.

Para actualizar una instalación existente y cargar datos ficticios consulta `../LEEME_ACTUALIZACION.md`. La base original está en `../creacion-diagrama.sql`; las cinco migraciones agregan acceso, catálogo, inventario, ventas y el enlace de la venta a su salida real de inventario. El esquema completo para una base nueva está en `../scripts/04_creacion_completa_solo_bd_nueva.sql`.

Rutas bajo `/api`:

- `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/profile`, `/auth/activity`.
- `/customers`: consulta y gestión de clientes.
- `/admin/users`, `/admin/sessions`, `/admin/audit`: gestión y supervisión administrativa.
- `/products`: catálogo.
- `/inventory`, `/inventory/movements`, `/inventory/:id/minimum`: saldos, movimientos y mínimos.
- `/sales`, `/sales/:id`, `/sales/:id/cancel`: registro, detalle y anulación.
- `/sales/summary`, `/sales/report`, `/sales/export`: indicadores, reportes y CSV.

Las consultas de ventas y reportes devuelven `{sales, summary, pagination, ...}`. Admiten `from`, `to`, `customer_id`, `product_id`, `status`, `search`, `page` y `page_size` (máximo 200; por defecto 50). El CSV usa los mismos filtros sin límite de página. Cuando se filtra por producto, los importes del reporte corresponden únicamente a sus líneas; el endpoint de detalle devuelve la venta completa.

Las lecturas de reportes se ejecutan en una transacción de solo lectura con una instantánea consistente. Los usuarios de consulta no pueden modificar clientes, catálogo, inventario o ventas. El administrador inicial se habilita con `npm run admin:bootstrap -- correo@ejemplo.com` después de registrar la cuenta, únicamente si aún no hay otro administrador activo.

Las pruebas (`npm test`, después de instalar `../tests`) utilizan una base PGlite aislada, no la conexión de este .env.
