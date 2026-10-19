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

- crear un uso a su nombre (con foto del tablero) y cerrarlo una sola vez, con km de bajada mayor al de subida;
- crear una carga de nafta (sólo categoría combustible, con foto del ticket);
- subir las fotos de tablero y ticket (no las puede leer ni pisar después);
- leer los vehículos, las obras y su propio uso abierto. Nada más: ni su historial.

El mail `juanmarcospaterno@gmail.com` es siempre admin (está fijo en `config.js` y en `firestore.rules`).

## Qué hace

**Chofer:** elige el vehículo → *Iniciar uso* (km, foto del tablero, obra o destino; la hora la pone el celular) → *Terminar uso* (km, foto del tablero, observaciones o daños) → *Cargar nafta* (km, litros, monto, estación, foto del ticket). Si inicia un uso en un vehículo que otra persona no cerró, se permite y el anterior queda «sin cerrar» para revisión. El km del vehículo se actualiza solo con el último km de bajada.

**Admin y encargado:**
- Inicio con el estado de cada vehículo y los avisos.
- Usos y cargas con filtros; detalle con fotos; corregir (fecha, km, chofer, obra, estado) con historial de correcciones; marcar revisado.
- Por vehículo: resumen, service (tareas por km y/o tiempo, con historial; tareas propias para moto), papeles con adjuntos y vencimiento, gastos en pesos y en dólares (blue del día, de dolarapi.com), multas (con el chofer deducido de los usos).
- Avisos (en la app y por notificación del navegador): service y papeles por vencer o vencidos, multas por pagar, km de subida distinto del último de bajada, saltos de km fuera de lo normal y usos abiertos hace más de 12 horas (configurable en *Más → Avisos de usos y km*). Botón de Google Calendar y descarga `.ics`.
- Reportes por mes o rango: km y horas por chofer; gasto, consumo (km/l) y costo por km por vehículo; usos y km por obra; gráficos. Exportación a Excel (.xlsx) con una hoja de usos, una de cargas de nafta y una de gastos.

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

`users/{mail}` (rol y estado) · `vehicles` · `obras` · `usos` · `expenses` (gastos; las cargas de nafta son gastos con `source: 'carga'`) · `tasks` (service) · `docs` (papeles) · `fines` (multas) · `config/general` · `files` (fotos y PDF en pedazos de base64). Cada uso, carga y gasto guarda quién lo cargó (mail y nombre) y cuándo (hora del servidor).

## Puesta en marcha (una sola vez)

1. **Firestore:** consola de Firebase → proyecto *flota-slavon* → *Compilación → Firestore Database* → *Crear base de datos* → modo producción → ubicación `southamerica-east1 (São Paulo)`.
2. **Reglas:** *Firestore Database → Reglas* → borrar todo → pegar el contenido de `firestore.rules` → *Publicar*.
3. **Login con Google:** *Compilación → Authentication → Comenzar → Sign-in method → Google → Habilitar* → elegir el mail de asistencia → *Guardar*.
4. **Dominio autorizado:** *Authentication → Configuración → Dominios autorizados → Agregar dominio* → `caixx32.github.io`.
5. **GitHub Pages:** repo → *Settings → Pages* → *Source: Deploy from a branch* → rama `main`, carpeta `/ (root)` → *Save*.
6. Entrar a la app con `juanmarcospaterno@gmail.com`. La primera vez se crean solos los 3 vehículos (2 utilitarios y 1 moto) con sus tareas de service y papeles básicos: editá nombre, patente, marca, año, km y foto desde *Vehículos*.

## Dar de alta choferes y encargados

*Más → Usuarios y permisos → Dar de alta* → mail de Google de la persona → rol (*Chofer*, *Encargado* o *Admin*) → *Guardar*. Ya puede entrar con ese mail. Para sacarle el acceso, entrá a su usuario y destildá *Activo*.

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
