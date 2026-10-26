# Orbit: primera etapa — acceso, usuarios y trazabilidad

Esta entrega implementa la primera etapa sobre el proyecto enviado. Productos, IVA, inventario y ventas se implementarán después de validar esta base. No se cambió tu base de Render ni se utilizaron las credenciales del ZIP.

## 1. Guarda una copia

Conserva una copia del proyecto anterior y un respaldo de PostgreSQL antes de aplicar cambios. La migración agrega columnas y tablas; no borra clientes ni usuarios. Los usuarios anteriores quedan activos con rol de consulta. Nadie obtiene privilegios administrativos automáticamente. Los tokens anteriores dejan de funcionar y habrá que iniciar sesión de nuevo.

## 2. Instala el proyecto

Extrae este ZIP en otra carpeta (por ejemplo Orbit_Etapa1) y ábrela en VS Code. Evita mezclar dos servidores Vite o dos backends en los mismos puertos.

Desde la raíz:

```bash
npm ci
```

Desde una segunda terminal:

```bash
cd backend
npm ci
```

## 3. Configura backend/.env

Copia tu .env local anterior a backend/.env. No viene incluido en esta entrega. Usa backend/.env.example como referencia si hace falta.

- PORT=5000 para el backend local.
- DATABASE_URL: URL externa de PostgreSQL para tu computador.
- JWT_SECRET: tu clave aleatoria, conservada de forma privada.

No publiques .env. Render usa sus propias variables: URL interna para backend y PostgreSQL en la misma región. El frontend no debe recibir la contraseña de la BD ni JWT_SECRET.

## 4. Prepara PostgreSQL

Si la base ya tiene users, customers y customer_status_history, NO vuelvas a crearla ni borres tablas. Si es una base totalmente nueva, ejecuta primero creacion-diagrama.sql con tu cliente SQL.

Luego, en la terminal situada en backend:

```bash
npm run build
npm run db:migrate
```

El segundo comando aplica migrations/001_access.sql y registra su ejecución en orbit_migrations. Se puede repetir db:migrate: el registro evita volver a aplicar la misma migración. No ejecutes directamente 001_access.sql y después db:migrate: utiliza un único procedimiento.

Si falla, conserva el mensaje y no elimines las tablas para intentar arreglarlo. Revisa que DATABASE_URL apunte a la base correcta y que el esquema inicial coincida con el suministrado.

## 5. Habilita el primer administrador

Si tu cuenta ya existe en users, desde backend ejecuta (sustituye el correo):

```bash
npm run admin:bootstrap -- tu_correo@ejemplo.com
```

Si aún no existe, primero inicia los dos servidores, regístrala en Orbit (quedará pendiente) y luego ejecuta ese comando. Solo funciona mientras no exista un administrador activo. No crea contraseñas ni recibe el rol desde el navegador. Esta acción también queda auditada.

## 6. Inicia ambos servidores

Terminal de backend:

```bash
npm run dev
```

Terminal de la raíz:

```bash
npm run dev
```

Abre la dirección Local que indique Vite. Si hay otro proceso ocupando 5000, detén ese proceso antes de probar. GET http://localhost:5000/test debe responder Backend OK. El archivo vite.config.ts conserva el proxy /api hacia ese puerto.

## 7. Comprueba el recorrido completo

1. Inicia sesión con tu cuenta administradora. Aparece Usuarios y auditoría en la cabecera.
2. En una ventana privada registra otra cuenta. Quedará consulta/pendiente aunque se intente enviar otro rol.
3. En Usuarios y auditoría selecciona Gestionar acceso sobre esa cuenta, rol Consulta, estado Activo y un motivo de al menos cinco caracteres. Guarda.
4. Inicia sesión con esa cuenta: puede consultar sus datos autorizados y no aparece Agregar cliente ni el menú de acciones.
5. No tiene acceso a /users ni a los endpoints administrativos. El backend rechaza las modificaciones aunque alguien intente llamar directamente a la API.
6. Desactiva la cuenta desde el administrador. Su siguiente petición devuelve 401 y exige iniciar sesión; no puede ingresar mientras esté inactiva.
7. Revisa Auditoría: muestra responsable, fecha, acción, registro, motivo y antes/después. Filtra por usuario y usa la paginación.
8. Revisa Sesiones: inicio, última actividad, vencimiento/revocación y motivo de cierre cuando existe.
9. No se permite cambiar el acceso de la propia cuenta desde esta pantalla. Para ello debe intervenir otro administrador.

IMPORTANTE: se conserva la separación original de clientes por owner_user_id. Un usuario nuevo de consulta verá su listado vacío hasta que se defina la asignación o el acceso compartido por empresa. Esta entrega no abre todos los clientes a todas las cuentas. La política de asignación y la posible tabla de empresas se definen antes de agregar productos y ventas compartidos.

## Cómo se calcula la actividad

Una sesión dura como máximo ocho horas y deja de ser válida después de treinta minutos sin actividad registrada. El frontend registra interacciones de teclado/puntero con una frecuencia máxima de una por minuto. Las operaciones POST/PATCH/DELETE también cuentan como actividad; las consultas GET automáticas del dashboard NO mantienen la sesión activa.

Cerrar la pestaña no produce un cierre de sesión confirmado: al transcurrir el plazo se observa como inactiva/vencida. No se puede probar presencia física, trabajo o ausencia solo con estos datos. Las horas se guardan desde el servidor y se presentan según la configuración del navegador. Sesiones muestra las últimas 200; la auditoría se pagina de 100 en 100.

## Seguridad y alcance

- Roles: admin y viewer. Estados: pending, active, inactive.
- El backend consulta rol, estado y sesión en PostgreSQL en cada petición autenticada; no confía en el rol almacenado en localStorage.
- Cambiar rol/estado revoca todas las sesiones anteriores del usuario afectado.
- La auditoría de users y customers usa triggers y transacciones; excluye password_hash. Contraseñas y tokens no se guardan en la auditoría.
- Los eventos LOGIN, LOGIN_FAILED, LOGIN_DENIED y LOGOUT se registran desde el backend. Expiración e inactividad se calculan a partir de los tiempos, no se inventa un momento exacto de salida.
- La aplicación no permite borrar auditoría y un trigger bloquea UPDATE/DELETE/TRUNCATE ordinarios. El propietario de PostgreSQL podría alterar esos controles: no es almacenamiento inmutable frente a un administrador de infraestructura.
- Se mantienen el diseño y el selector Español/English. Algunas descripciones técnicas de auditoría se muestran en el idioma original del evento.
- No es todavía un sistema completo contra fraude: falta separación de responsabilidades en ventas e inventario, supervisión independiente y controles operativos.

## Render

Después de comprobar localmente la etapa: sube el código a tu repositorio y utiliza para el backend Root Directory backend, Build Command npm ci && npm run build y Start Command npm start. La migración se ejecuta contra cada base antes de desplegar esta versión. No configures la migración ni el bootstrap dentro del comando de inicio.

El frontend utiliza /api con el proxy de Vite durante desarrollo. Para publicar el frontend por separado sigue siendo necesaria una ruta /api hacia el backend o adaptar de forma uniforme las URLs de la API: no basta con publicar el frontend tal como está y esperar que el proxy de desarrollo exista en producción.

## Pruebas realizadas y cómo repetirlas

- Frontend: npm run build en la raíz.
- Backend: npm run build dentro de backend.
- Integración: esquema y migración en PostgreSQL embebido PGlite, con llamadas HTTP a la aplicación Express. Incluye escalamiento de rol rechazado, permisos, aprobación, bloqueo, revocación, auditoría, inactividad y conservación de secretos.

Para repetir estas pruebas SIN usar Render ni tu .env (después de compilar backend):

```bash
cd tests
npm install
npm test
```

No se realizaron pruebas visuales de interacción en navegador ni un despliegue real de Render. Debes completar el recorrido manual del punto 7.

## Siguientes entregas

2. Definir empresa/alcance de datos y quién puede registrar ventas; catálogo de productos/servicios, precios e impuestos configurables e historial de cambios.
3. Movimientos de inventario: entradas, salidas y ajustes justificados; existencias no editables directamente y servicios sin stock.
4. Ventas y detalle con precio/IVA histórico, cálculo en backend, transacción atómica con inventario, anulaciones y protección contra duplicados.
5. Dashboard comercial: ventas por periodo, ticket promedio, clientes frecuentes, productos vendidos y filtros del documento.

La tarifa y el tratamiento de IVA requieren definición por producto y validación tributaria antes de uso real. No se incluyó una tarifa por defecto ni una clasificación fiscal inventada.
