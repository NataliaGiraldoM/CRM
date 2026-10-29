# ORBIT CRM: correcciones y demostración

Este paquete contiene el proyecto completo, sin node_modules, .git, dist ni credenciales.
Conserva tus .env actuales. Las pruebas no se ejecutaron contra tu BD de Render.

## 1. Aplicar los archivos

1. Guarda una copia de tu proyecto y un respaldo de tu BD antes de actualizar.
2. Detén frontend y backend. Copia los archivos del paquete a la raíz de tu repo (donde están package.json y la carpeta backend). Conserva .git y tus .env; no debes copiar una carpeta CRM dentro de otra CRM.
3. El .env del backend debe estar en backend/.env. Se carga desde esa ruta tanto en desarrollo como al ejecutar dist. Contiene DATABASE_URL, JWT_SECRET y PORT. Mantén los valores de tu instalación; no cambies el JWT_SECRET como parte de esta actualización.
4. Instala y compila:

```bash
# Desde la raíz CRM
npm ci
cd backend
npm ci
npm run build
```

## 2. Actualizar tu base existente

Desde backend, con el backend aún detenido:

```bash
npm run db:migrate
```

La migración nueva es 005_sales_inventory_snapshot. Agrega un enlace entre cada línea de venta y su salida original de inventario. Relaciona también las ventas antiguas mediante el motivo `Sale UUID` que guardaba el código anterior. No elimina tablas, ventas ni movimientos.

Puedes verificar los nombres de migraciones con scripts/00_estado_migraciones.sql en DBeaver.

Si anteriormente ejecutaste las tablas de ventas manualmente y el comando informa `relation "sales" already exists`, no borres las tablas. Con las tablas 001 a 004 ya presentes, puedes aplicar SOLO la corrección nueva ejecutando scripts/05_actualizar_bd_existente_DBeaver.sql en DBeaver. Este archivo también registra la migración 005 y admite repetición. Esto no regulariza registros históricos ausentes de las migraciones 001 a 004; conserva el mensaje y revisa ese registro antes de volver a usar el migrador completo.

El archivo scripts/04_creacion_completa_solo_bd_nueva.sql es exclusivamente para crear una base nueva y vacía. NO lo ejecutes para actualizar tu BD actual. No ejecuta una carga de datos ni crea cuentas.

Si ya se habían anulado ventas con el error anterior, la actualización no reescribe sus movimientos históricos. Ejecuta scripts/06_revision_anulaciones_anteriores.sql para detectar posibles devoluciones sin salida original; revisa el saldo físico y registra un ajuste desde Inventario con su motivo si corresponde.

## 3. Arrancar localmente

Terminal 1, dentro de backend:

```bash
npm run dev
```

Terminal 2, desde la raíz del CRM:

```bash
npm run dev
```

En desarrollo deja VITE_API_URL vacío o sin definir: el proxy de Vite envía /api al backend local en el puerto 5000. En producción, si el frontend y el backend están en servicios distintos, define VITE_API_URL con el origen HTTPS de tu backend, sin /api ni una barra final, y vuelve a compilar el frontend. Ejemplo: https://tu-backend.onrender.com. Las rutas directas del frontend requieren una regla SPA que entregue index.html. JWT_SECRET y DATABASE_URL pertenecen solo al backend.

## 4. Cargar información ficticia en DBeaver

Conéctate a la misma base usada en DATABASE_URL y abre cada archivo como script SQL.

1. Abre scripts/01_datos_demostracion.sql.
2. Cambia TU_CORREO_ADMIN_AQUI por el correo de TU administrador activo. Solo se usa para asociar los registros y su auditoría; no cambia su contraseña ni sus permisos.
3. Ejecuta el archivo completo con «Ejecutar script SQL» (Alt+X en la configuración habitual de DBeaver).
4. La carga crea 8 clientes, 12 elementos de catálogo (9 productos y 3 servicios), 90 ventas (84 completadas y 6 anuladas), sus detalles y movimientos. Todos los nombres llevan DEMO; los códigos comienzan ORBIT-DEMO-.
5. La carga es transaccional y admite repetición: si ya existe su marcador, no duplica registros. Si ocurre un error, ejecuta ROLLBACK antes de volver a intentar en esa conexión.
6. Recarga las páginas del CRM. Los reportes inician con los últimos 30 días; borra las fechas para consultar toda la demostración. Busca DEMO para excluir otros clientes y ventas de los indicadores.
7. Ejecuta scripts/02_comprobaciones.sql para contrastar cantidades, dinero, IVA, stock, frecuencia, concentración, productos sin ventas, auditoría y sesiones.

La información ficticia también contará en los indicadores generales de esta BD. Utiliza una copia de pruebas si no quieres mezclarla con tus datos reales. No se incluye un borrado de movimientos ni auditoría: son registros inmutables. Las acciones manuales sobre los datos DEMO cambiarán naturalmente los resultados iniciales esperados.

## 5. Probar cuentas y sesiones

El script opcional scripts/03_usuarios_sesiones_demo.sql crea tres cuentas de consulta. Cambia también su TU_CORREO_ADMIN_AQUI y ejecuta el archivo completo. No crea administradores ni modifica usuarios preexistentes.

Contraseña de demostración de las tres cuentas: `OrbitDemo2026!`.

- orbit-demo-consulta@example.invalid: activa. Puede consultar clientes, catálogo, inventario, ventas y reportes; no puede gestionar cuentas, modificar existencias ni registrar/anular ventas.
- orbit-demo-pendiente@example.invalid: pendiente. No puede iniciar sesión hasta que tu administrador la apruebe.
- orbit-demo-inactivo@example.invalid: inactiva. No puede iniciar sesión.

Estas cuentas tienen una contraseña pública de prueba. Úsalas solo para la demostración y desactívalas desde tu administrador cuando termines. Para comprobar la creación y aprobación reales, también puedes registrar otra cuenta desde la pantalla Registro y aprobarla desde Auditoría.

El script añade tres sesiones ilustrativas sin JWT emitido: inactiva, expirada y revocada. Un inicio de sesión real crea su propia sesión activa y sus eventos de auditoría. Los estados inactivo/expirado varían con el tiempo; el segundo script permite verlos. No representan un registro histórico de trabajo de una persona real.

## 6. Comprobación por módulo

| Tema | Acción en el CRM | Resultado esperado |
| --- | --- | --- |
| Roles | Inicia con la cuenta de consulta | Puede leer; no ve botones administrativos. El backend también rechaza escrituras. |
| Aprobación | Intenta entrar con la cuenta pendiente; luego actívala como admin | Se bloquea antes de la aprobación y puede entrar después. |
| Revocación | Con una cuenta de consulta conectada, desactívala desde otro navegador como admin | Sus peticiones posteriores son rechazadas. |
| Perfil | Cambia tu nombre desde el menú de usuario | Persiste al recargar y aparece actualizado en la cabecera. |
| Clientes | Crea y edita un cliente nuevo con datos válidos | Guarda los cambios y rechaza correos duplicados. |
| Protección del historial | Intenta eliminar DEMO Cliente 1 | Muestra que tiene ventas y recomienda desactivarlo. No borra compras. |
| Historial | Clientes → Ver detalles → Historial de compras | Abre el reporte filtrado por ese cliente; «Ver venta completa» muestra productos, precios e IVA. |
| IVA y catálogo | Consulta códigos ORBIT-DEMO-01, 02 y 03 | Hay gravado 19 %, exento y excluido. Los servicios 10 a 12 no aparecen como existencias. |
| Stock bajo | Abre Inventario | ORBIT-DEMO-08 tiene 3 y mínimo 10; ORBIT-DEMO-09 tiene 0. Ambos están bajos. |
| Movimientos | Como admin, registra una entrada o salida de un producto DEMO | Cambia el saldo y queda autor/motivo en movimientos y auditoría. |
| Venta | Registra una venta de un producto con stock y un servicio | Suma precios e IVA; solo el producto con inventario descuenta stock. |
| Anulación | Anula esa venta y vuelve a intentarlo | Devuelve solo unidades descontadas originalmente; no permite otra anulación. |
| Cambio de seguimiento | Crea un producto sin inventario, véndelo, activa inventario y anula esa venta | No aparecen existencias ficticias. |
| Filtro por producto | Selecciona un código DEMO en Reportes | Los importes corresponden a sus líneas, no a toda la cesta. El detalle completo mantiene el total original de la venta. |
| Frecuencia/concentración | Borra fechas, busca DEMO y genera reporte | Muestra compras por cliente, compras por cliente comprador y participación en ingresos. |
| Comparación/disminución | Selecciona últimos 30 días y busca DEMO | Compara con los 30 días anteriores; existen clientes con disminución (Cliente 1). |
| Menor demanda | Consulta la tabla de menos vendidos | Incluye productos/servicios con cero unidades. Es demanda por unidades, no la razón contable de rotación de inventarios. |
| Paginación | Borra fechas, busca DEMO y genera reporte | 90 ventas en dos páginas de 50 y 40 antes de realizar acciones manuales. Los totales son iguales en ambas páginas. |
| Exportación | En ese reporte, exporta CSV | Descarga las 90 ventas filtradas, no solo las de la página actual. Incluye anuladas si Estado es Todos. |
| Dashboard | Revisa ingresos, promedio y ventas | Las anuladas quedan fuera de ingresos y promedio. La gráfica de estados aclara que agrupa el estado actual por mes de creación. |
| Idioma | Cambia ES/EN en el menú del usuario | Traduce las pantallas y mensajes añadidos. Los nombres, motivos escritos por usuarios e identificadores técnicos se conservan. |
| Auditoría | Filtra por tu administrador | La carga DEMO y las operaciones muestran su autor y motivo; no se exponen hashes de contraseña. |

Los filtros de reportes se aplican con «Generar reporte». Cambiar los campos sin pulsarlo no cambia las cifras, páginas ni el CSV. Las cuentas o productos inactivos siguen disponibles como filtros para consultar su historial.

## 7. Pruebas automáticas incluidas

Desde la raíz, después de instalar frontend y backend:

```bash
cd tests
npm ci
cd ..
npm run test:integration
npm run build
```

Las pruebas usan PostgreSQL embebido (PGlite), datos ficticios y un pool sustituido. No leen tu conexión de Render ni envían peticiones a ella. Cubren roles, sesiones, auditoría, catálogo, IVA, inventario, ventas/anulaciones, migración sobre ventas antiguas, esquema nuevo, scripts SQL repetibles, paginación y exportación. El script 02 contiene consultas de verificación para ejecutarlas también sobre PostgreSQL real.

La revisión de interfaz fue por código y compilación; revisa visualmente las pantallas en tu navegador. No se ha desplegado este paquete en Render ni se ha modificado tu repositorio remoto.
