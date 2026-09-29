# DuiX — Cálculo en modo arcade

Juego PWA (funciona en Mac, Windows, iPhone y Android desde el navegador, e instalable como app).

## Subirlo a GitHub (sin instalar nada)
1. Entra a https://github.com y crea cuenta / inicia sesión.
2. Botón **New repository** → nombre `duix` → **Public** → **Create repository**.
3. En la página del repo pulsa **uploading an existing file**.
4. Descomprime este zip y **arrastra todo el contenido** (index.html, sw.js, manifest.webmanifest, carpetas css, js, fonts, icons…). Importante: arrastra los archivos y carpetas, no la carpeta contenedora.
5. Abajo pulsa **Commit changes**.

## Publicarlo en Vercel
1. Entra a https://vercel.com → **Sign up with GitHub**.
2. **Add New… → Project** → elige el repo `duix` → **Import**.
3. No cambies nada (Framework: *Other*, sin build) → **Deploy**.
4. En ~30 s te da un link tipo `https://duix.vercel.app`. Ese es el link para el profesor.

## Instalarlo como app
- iPhone (Safari): Compartir → **Añadir a pantalla de inicio**.
- Android (Chrome): menú ⋮ → **Instalar app**.
- Mac/Windows (Chrome/Edge): icono de instalar en la barra de direcciones.

## Actualizar
Sube los archivos nuevos al mismo repo (Add file → Upload files, sobrescribe). Vercel republica solo.

## Novedades de la versión 1.1
- Héroe hombre o mujer, con 4 colores base gratis por género y muchos más objetos para comprar.
- Alas, mascotas (dragón bebé, fénix…), armaduras, túnicas, cascos y armas que se ven en la mano.
- En el Vestidor puedes probarte todo aunque aún no lo tengas.
- Cada pregunta da tiempo para leer y una cuenta regresiva 3-2-1.
- Música Arcade o Calmada (Ajustes) y opción de más tiempo para leer.
- Al fallar se ve qué elegiste y cuál era la correcta.
- Pistas y repasos más claros, con referencia a Stewart (Precálculo).

### Cómo actualizar en GitHub
Entra a tu repositorio → **Add file → Upload files** → arrastra los archivos y carpetas nuevos (sobrescriben a los anteriores) → **Commit changes**. Vercel publica solo en ~30 segundos. Si en el celular ves lo viejo, cierra y abre la app dos veces.


## Novedades 1.2
- Cada pelea tiene 5 preguntas en todos los niveles; lo que cambia es la dificultad y la velocidad.
- Vestidor: el avatar y el botón de comprar quedan siempre a la vista; solo se desliza la ropa.
- En modo solo, el menú de pausa permite cambiar la música y los efectos.
- "Más tiempo para leer" ya no está en Ajustes: será una opción al crear salas (Parte 3).

## Novedades 1.3 — Salas multijugador (Firebase)
Archivos nuevos: `js/net.js`, `js/rooms.js`, `js/firebase-config.js` y la carpeta `js/vendor/` (Firebase y generador de QR, para que todo cargue rápido).

**Reglas de seguridad de Firebase** (importante, hacerlo una sola vez):
1. Firebase → Realtime Database → pestaña **Reglas**.
2. Borra todo y pega esto, luego pulsa **Publicar**:

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['host', 'cfg', 'state'])"
      }
    }
  }
}
```
Así nadie puede listar todas las salas: solo entra quien conoce el código. Las reglas del "modo de prueba" vencen a los 30 días, por eso hay que reemplazarlas.

**Cómo se juega:** Salas → Crear sala (el anfitrión elige preguntas, dificultad, tiempo, temas y "más tiempo para leer") → comparte el código de 4 letras o el QR → todos entran → Empezar partida.

## Novedades 1.4
- **Salas en modo arcade:** todos pelean a la vez contra el mismo villano con las mismas preguntas; ranking en vivo arriba y el villano pierde vida con los aciertos de toda la sala. Podio al final.
- **Fondos animados** (dragones, símbolos de cada tema, estrellas, ondas, ciudad y rejilla retro) en el mapa, los distritos, las salas y dentro de las peleas.
- **Preguntas por pelea:** bajan al subir la dificultad. Villanos: 4 · 3 · 2. Jefes (Indeterminado): 5 · 4 · 3.
- Arreglo del cuadro del código de sala (no dejaba escribir en algunos celulares).
- Las reglas de Firebase son las mismas de la versión 1.3 (no hay que cambiarlas).

## Novedades 1.5
- Teclado propio en pantalla para escribir el código de sala (funciona en cualquier dispositivo; el teclado físico también sirve).
- Fondo del mapa convertido en un mundo de caramelo: arcoíris, sol sonriente, islas de chocolate, paletas, cupcakes, dulces con símbolos matemáticos y dragones pastel con estela de arcoíris. El cielo cambia de color (día → atardecer → noche mágica) al recorrer el mapa.

## Novedades 1.6
- **Salas arregladas**: el área de juego no se dibujaba (solo se veía la pregunta). Ya se ve el villano, las cápsulas y tu héroe.
- **Pantalla completa en cualquier dispositivo** (Mac, PC, iPhone, Android): el juego ocupa toda la altura, sin franjas vacías.
- **Pregunta grande**: se quitó el 3‑2‑1. La pregunta sale grande con una barra de tiempo, luego se acomoda en su recuadro y ahí caen las respuestas (más lentas; suben un poco de velocidad con el nivel).
- **Mapa en camino** estilo mapa de niveles: niveles numerados en zigzag, camino que se ilumina al avanzar, tu héroe marca dónde vas.
- **3 juegos por distrito**: Nivel 1 *Disparo*, Nivel 2 *Carrera* (elige la puerta correcta corriendo por carriles), Nivel 3 *Pares* (une problema con resultado contra reloj). Puedes elegir cualquiera desbloqueado; el siguiente se abre al superar el anterior.
- Tarjetas de nivel a todo color. Las salas siguen usando el juego de disparo.
