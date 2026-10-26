# Cambios de la etapa 2

- backend/migrations/002_catalog.sql: tabla products y trigger de auditoría.
- backend/src/scripts/setup.ts: aplica secuencialmente 001_access y 002_catalog con registro de migraciones.
- backend/src/routes/product.routes.ts: consulta autenticada, alta/edición administrativa, validación, cálculo decimal y conflictos de versión.
- backend/src/app.ts: registro de las rutas de catálogo.
- backend/src/services/customer.service.ts: clientes compartidos de la única empresa; owner_user_id conserva creador, y el usuario actor se registra en auditoría.
- src/app/pages/Products.tsx y styles/products.scss: catálogo, filtros y formulario.
- src/App.tsx, Header.tsx, header.scss y es.json: navegación, traducciones y adaptación de cabecera.
- tests/access.integration.cjs: ampliación de pruebas del backend.

El resto conserva el comportamiento de la etapa 1 y su actualización visual de auditoría.
