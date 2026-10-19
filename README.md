# Flota Slavon

App web para la flota de vehículos de **Slavon High Sport Performance**: usos, cargas de nafta, service, papeles, gastos, multas, avisos y reportes.

**App:** https://caixx32.github.io/flota-slavon/

- Pensada para el celular e instalable como app (PWA): en Android, menú ⋮ → «Instalar app»; en iPhone, Safari → Compartir → «Agregar a inicio».
- Funciona sin señal: todo lo que se carga queda guardado en el celular y se sube solo cuando vuelve la conexión (Firestore con caché offline).
- Login con Google. Sólo entran los mails dados de alta por un admin.
- HTML, CSS y JavaScript sin framework ni compilación. Firebase (Auth + Firestore) por CDN. Las fotos se guardan comprimidas dentro de Firestore (no se usa Firebase Storage).

## Roles

| | Admin | Encargado | Chofer |
|---|:-:|:-:|:-:|
| Iniciar / terminar uso, cargar nafta | ✔ | ✔ | ✔ |
| Ver historial de usos, gastos, service, papeles, multas, reportes | ✔ | ✔ | ✘ |
| Revisar y corregir usos (queda registrado quién y cuándo) | ✔ | ✔ | ✘ |
| Agregar / editar / dar de baja vehículos, obras, configuración | ✔ | ✔ | ✘ |
| Gestionar usuarios y roles | ✔ | ✘ | ✘ |

Los permisos los imponen las **reglas de Firestore** (`firestore.rules`), no sólo la interfaz: un chofer no puede leer ni modificar lo que no le corresponde aunque vaya directo a la base. El chofer sólo puede:

- crear un uso a su nombre (con foto del tablero) en el mismo lote en que el vehículo pasa a «en uso»: no se pueden crear usos sueltos;
- el «último km de bajada» que queda guardado en el uso tiene que ser el km real del vehículo, así no puede esconder el aviso de km raros;
- tener un solo uso abierto a la vez (candado `locks/{mail}`): hasta cerrar el anterior no puede iniciar otro en ningún vehículo;
- cerrar su uso una sola vez, con km de bajada mayor al de subida;
- crear una carga de nafta (sólo combustible, de un vehículo activo, con fecha válida y foto del ticket);
- subir las fotos de tablero y ticket: como mucho 2 pedazos de 700.000 caracteres por foto, sin poder leerlas ni pisarlas después;
- leer los vehículos, las obras y su propio uso abierto. Nada más: ni su historial. Tampoco puede cambiarse el nombre (lo pone el admin).

Los usos **no se borran** (ni siquiera el admin): se anulan con motivo, quedan en el historial y dejan de contar en reportes y avisos.

El mail `juanmarcospaterno@gmail.com` es siempre admin y siempre puede entrar, aunque su usuario figure inactivo (está fijo en `config.js` y en `firestore.rules`).

## Qué hace

**Chofer:** elige el vehículo → *Iniciar uso* (km, foto del tablero, obra o destino; la hora la pone el celular) → *Terminar uso* (km, foto del tablero, observaciones o daños) → *Cargar nafta* (km, litros, monto, estación, foto del ticket). Si inicia un uso en un vehículo que otra persona no cerró, se permite y el anterior queda «sin cerrar» para revisión. Si el mismo chofer tiene un uso abierto, primero tiene que terminarlo. El km del vehículo se actualiza solo con el último km de bajada.

**Admin y encargado:**
- Inicio con el estado de cada vehículo y los avisos. El admin ve una tarjeta de **Primeros pasos** hasta completar todo (choferes, obras, patente/km/foto de cada vehículo, último service y vencimientos). Mientras falten datos de service o papeles, la app muestra «Faltan datos» en lugar de «Todo en orden».
- Usos y cargas con filtros; detalle con fotos; corregir (fecha, km, chofer, obra, estado) con historial de correcciones; marcar revisado; anular con motivo.
- Por vehículo: resumen, service (tareas por km y/o tiempo, con historial; tareas propias para moto), papeles con adjuntos y vencimiento, gastos en pesos y en dólares, multas (con el chofer deducido de los usos). Al editar un vehículo se guardan sólo los campos cambiados; si tiene un uso abierto, no se le puede cambiar el estado hasta terminar o anular ese uso.
- Dólar blue: para gastos de hoy, la cotización del día (dolarapi.com); para fechas pasadas, la histórica de esa fecha (api.argentinadatos.com). Si no se consigue, la de hoy marcada como aproximada.
- Quién y cuándo: usos, cargas, gastos, tareas de service, papeles y obras guardan quién los creó y quién los editó por última vez.
- Avisos (en la app y por notificación del navegador): service y papeles por vencer o vencidos, multas por pagar, km de subida distinto del último de bajada, saltos de km fuera de lo normal y usos abiertos hace más de 12 horas (configurable en *Más → Avisos de usos y km*). Botón de Google Calendar y descarga `.ics`.
- Reportes por mes o rango: km y horas por chofer; gasto, consumo (km/l) y costo por km por vehículo; usos y km por obra; gráficos. Exportación a Excel (.xlsx) con hojas de usos, cargas de nafta, gastos, resumen por chofer, resumen por vehículo, resumen por obra, multas e historial de service. Los usos anulados no cuentan.

**Sobre los avisos:** los de service, papeles y multas dependen de fechas; los de usos sin cerrar (más de 12 h) y km raros se calculan cuando alguien abre la app, así que llegan como notificación con la app abierta o al abrirla. En iPhone no hay avisos con la app cerrada. En Android, con Chrome y la app instalada, los vencimientos pueden avisar en segundo plano.

**Con mala señal:** la app intenta bajar la versión nueva, pero si la red no contesta en 3 segundos abre con lo guardado en el celular.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html`, `styles.css` | Pantalla y estilos (colores del logo: grafito `#22282C` y rojo `#E60D2D`). |
| `config.js` | Configuración de Firebase y mail del dueño. |
| `cloud.js` | Conexión con Firebase: login, lecturas, escrituras en lote y archivos partidos en pedazos. |
| `store.js` | Estado, fotos comprimidas (máx. 1600 px, JPEG 0,7), dólar, estados de service/papeles/multas, avisos, calendario y notificaciones. |
| `ui.js` | Íconos, formularios, hojas y avisos breves. |
| `flows.js` | Iniciar/terminar uso, cargar nafta y formularios de admin y encargado. |
| `views.js`, `reports.js` | Pantallas, reportes y exportación a Excel (SheetJS por CDN). |
| `app.js` | Arranque, login, rol del usuario y sincronización. |
| `sw.js`, `manifest.webmanifest`, `icons/` | App instalable y funcionamiento sin señal. |
| `firestore.rules` | Reglas de seguridad para pegar en la consola de Firebase. |
| `tests/` | Pruebas automáticas de las reglas con el emulador de Firebase. |

## Datos en Firestore

`users/{mail}` (rol y estado) · `vehicles` · `obras` · `usos` (nunca se borran: `anulado`, `anuladoPor`, `anuladoEn`, `motivo`) · `locks/{mail}` (uso abierto de cada chofer) · `expenses` (gastos; las cargas de nafta son gastos con `source: 'carga'`) · `tasks` (service) · `docs` (papeles) · `fines` (multas) · `config/general` · `files` (fotos y PDF en pedazos de base64). Cada uso, carga y gasto guarda quién lo cargó (mail y nombre) y cuándo (hora del servidor).

## Puesta en marcha (una sola vez)

1. **Firestore:** consola de Firebase → proyecto *flota-slavon* → *Compilación → Firestore Database* → *Crear base de datos* → modo producción → ubicación `southamerica-east1 (São Paulo)`.
2. **Reglas:** *Firestore Database → Reglas* → borrar todo → pegar el contenido de `firestore.rules` → *Publicar*.
3. **Login con Google:** *Compilación → Authentication → Comenzar → Sign-in method → Google → Habilitar* → elegir el mail de asistencia → *Guardar*.
4. **Dominio autorizado:** *Authentication → Configuración → Dominios autorizados → Agregar dominio* → `caixx32.github.io`.
5. **GitHub Pages:** repo → *Settings → Pages* → *Source: Deploy from a branch* → rama `main`, carpeta `/ (root)` → *Save*.
6. Entrar a la app con `juanmarcospaterno@gmail.com`. La primera vez se crean solos los 3 vehículos (2 utilitarios y 1 moto) con sus tareas de service y papeles básicos: editá nombre, patente, marca, año, km y foto desde *Vehículos*.

## iPhone: entrar con la app instalada

En iPhone, con la app agregada a la pantalla de inicio, a veces la ventana de Google no vuelve sola a la app. Si pasa eso, la pantalla de ingreso lo explica:

1. Cerrá la ventana de Google si quedó abierta.
2. Abrí **Safari**, entrá a https://caixx32.github.io/flota-slavon/ e iniciá sesión con Google ahí.
3. Volvé a abrir la app desde la pantalla de inicio.

Ojo: en algunas versiones de iOS la app instalada guarda su sesión aparte de Safari, y aunque hayas entrado en Safari te vuelve a pedir el ingreso. En ese caso, usá la app directamente desde Safari (funciona igual, también sin señal) o borrala de la pantalla de inicio y volvé a agregarla después de iniciar sesión en Safari.

## Dar de alta choferes y encargados

*Más → Usuarios y permisos → Dar de alta* → mail de Google de la persona → rol (*Chofer*, *Encargado* o *Admin*) → *Guardar*. Ya puede entrar con ese mail. Para sacarle el acceso, entrá a su usuario y destildá *Activo*. El nombre de cada usuario lo pone el admin (el chofer no lo puede cambiar).

## Probar en la compu con los emuladores

Hace falta Node.js 18+ y Java 21+.

```bash
cd tests
npm install
npm test                      # corre las pruebas de las reglas
npx firebase emulators:start --config ../firebase.json --only firestore,auth --project demo-flota
```

Con los emuladores andando, serví la carpeta del repo (por ejemplo `npx http-server .. -p 5173`) y abrí `http://localhost:5173/?emu`: aparece un recuadro para entrar con cualquier mail de prueba sin Google.

## Actualizar la app

Al cambiar cualquier archivo, subí el número de `CACHE` en `sw.js` (por ejemplo `flota-v2`) para que los celulares bajen la versión nueva.
