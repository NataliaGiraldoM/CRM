# Archivos principales de esta etapa

- backend/migrations/001_access.sql: columnas de usuarios, sesiones y auditoría; triggers.
- backend/src/scripts/setup.ts: aplicación controlada de migración y primer administrador.
- backend/src/services/auth.service.ts: registro pendiente y login con sesión persistida.
- backend/src/middlewares/auth.middleware.ts: permisos actuales, revocación y vencimiento.
- backend/src/routes/access.routes.ts: sesión actual, actividad, logout, usuarios y auditoría.
- backend/src/services/access.service.ts: transacciones y eventos sin secretos.
- backend/src/services/customer.service.ts: actor y transacción para auditar cambios.
- backend/src/routes/customer.routes.ts: escrituras solo para administrador.
- src/app/components/AccessGuard.tsx: revisión de acceso y envío de actividad.
- src/app/pages/Users.tsx: administración y consulta de auditoría/sesiones.
- src/services/access.service.ts: peticiones autenticadas y manejo de sesión inválida.
- Login/Register/Header/Customers/App: integración de permisos y estado pendiente.
- src/i18n/es.json y estilos: traducciones y presentación de usuarios.

Para una copia limpia, usa este proyecto completo y agrega tu .env privado. No incluye dependencias instaladas, .git, archivos ZIP anteriores ni secretos.
