# ORBIT CRM

CRM académico para centralizar clientes, catálogo de productos y servicios, inventario, ventas, usuarios y analítica descriptiva.

Empieza por **LEEME_ACTUALIZACION.md**: contiene los pasos para actualizar una BD existente, iniciar el proyecto y comprobar cada módulo con los scripts de demostración.

- Frontend: React, TypeScript, Vite y Sass.
- Backend: Express, TypeScript y PostgreSQL.
- Roles: administrador y usuario de consulta (`admin` / `viewer`).
- Auditoría de cambios, sesiones y revocación de accesos.
- Reportes filtrados, comparación entre períodos, frecuencia y concentración por cliente, productos más/menos vendidos, detalle de compras y CSV completo.

Los archivos SQL están en `scripts/`. La carga de demostración es opcional, ficticia y repetible. No se incluyen credenciales reales.

Instala dependencias con `npm ci` en la raíz y en `backend`. Para las pruebas instala también con `npm ci` dentro de `tests`. Luego, desde la raíz, ejecuta `npm run test:integration` y `npm run build`.
