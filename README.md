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

## Novedades 1.7.2
- Los 3 juegos (Disparo, Carrera, Laberinto) y el combate de las salas ahora llenan TODA la pantalla en computador, sin marco ni columna angosta.
- Emotes estilo Free Fire / Fortnite: 14 bailes y gestos animados en la tienda (pestaña Emotes), se equipa uno de victoria (baila en la pantalla de resultados) y en las salas hay una rueda de emotes con los que tengas.
- Mapa: héroe más grande y zoom más marcado al hacer scroll.

## Novedades 1.7.1
- Laberinto tipo Pac-Man real: las respuestas son fantasmas que se mueven; te comes el de la respuesta correcta. Píldoras Σ = poder (los fantasmas huyen y, si los atrapas, van a la cárcel). Avatar más lento.
- Preguntas por partida bajan con el nivel: Disparo 4, Carrera 3, Laberinto 2 (jefes +1).
- Disparo y Carrera más lentos y con más tiempo para leer; la pregunta se ve más grande.
- Botón «Reiniciar» en la pausa de cada juego.
- Salas: plaza a pantalla completa, engranaje (⚙) solo para el anfitrión (configura la sala) y para los demás (sonido); tiempo por pregunta de 15 s a 1 min.
- Creador de héroe igual que el vestidor (avatar fijo y flotando), mapa con iconos flotantes fijos (Ruleta, Vestidor, Metas, Salas).

## Novedades 1.7
- Pantalla completa real: fondos animados a todo el ancho en Mac/PC; en celular llena toda la pantalla (incluido el borde inferior).
- Mapa del mundo estilo camino de niveles: cada tablero tiene 3 niveles (Disparo → Carrera → Laberinto) y el siguiente tablero se abre solo al pasar el nivel 3.
- 3 juegos arcade fluidos, sin pausas entre preguntas, con tu avatar como protagonista (Carrera libre con minas/monedas/poderes y Laberinto tipo Pac-Man).
- Salas tipo lobby: se mueven, emotes, cambio de ropa, sin vidas, revancha y volver a la sala.
- Ruleta de la Fortuna (giro gratis diario, giros por pregunta y por victoria) y símbolos Σ canjeables.
- Título interactivo (toca al héroe) y vestidor con escenario animado.

## Novedades 1.6
- **Salas arregladas**: el área de juego no se dibujaba (solo se veía la pregunta). Ya se ve el villano, las cápsulas y tu héroe.
- **Pantalla completa en cualquier dispositivo** (Mac, PC, iPhone, Android): el juego ocupa toda la altura, sin franjas vacías.
- **Pregunta grande**: se quitó el 3‑2‑1. La pregunta sale grande con una barra de tiempo, luego se acomoda en su recuadro y ahí caen las respuestas (más lentas; suben un poco de velocidad con el nivel).
- **Mapa en camino** estilo mapa de niveles: niveles numerados en zigzag, camino que se ilumina al avanzar, tu héroe marca dónde vas.
- **3 juegos por distrito**: Nivel 1 *Disparo*, Nivel 2 *Carrera* (elige el cartel correcto corriendo por carriles), Nivel 3 *Pares* (une problema con resultado contra reloj). Puedes elegir cualquiera desbloqueado; el siguiente se abre al superar el anterior.
- Tarjetas de nivel a todo color. Las salas siguen usando el juego de disparo.

## Novedades 1.8.0 (rúbrica del profesor)
- **Tablero 15 «Límites» (Aproximín):** concepto intuitivo, tabulación por ambos lados y cálculo básico (sustitución, 0/0, conjugado, al infinito). También «punto-pendiente» en Plano cartesiano.
- **Puntaje oficial sobre 100:** 15 tableros × 6 pts + jefe 10 pts. Pantalla **Créditos y puntaje** (Ajustes, mapa 🏆 y fin del jefe) con el nombre del autor (`AUTHOR` en `js/data.js`: escribe ahí tu nombre completo).
- **Retroalimentación** al acertar y al fallar en los 3 juegos (tarjeta que explica el porqué).
- **Mini-tutorial** por juego, con «Omitir» y «No volver a mostrar».
- **Pac-Man con túneles** laterales que teletransportan.
- **Salas:** los 3 juegos seguidos y **modo Impostor** (sabotajes: turbo, niebla, robo; votación cada 3 preguntas). No requiere cambiar las reglas de Firebase.
- Héroe más grande (título y mapa), botón 💃 Emotes en el mapa, emotes Baile y Salto gratis.
- La app ahora se actualiza sola (red primero + recarga al detectar versión nueva).

## Novedades 1.8.1
- **Práctica dentro del juego**: ya no hay popup; el primer intento de cada juego es una mini-ronda de práctica en la misma pantalla, con una tira-guía arriba y botón *Omitir*.
- **Carrera**: la pregunta sale al centro y vuelve a su lugar en cada pregunta; al acertar los carteles caen rápido y sigue la siguiente; minas visibles y siempre lejos de los carteles; instrucciones corregidas (cartel, no puerta).
- **Laberinto**: fantasmas más lentos e impredecibles (cada uno con personalidad y errores), y transición clara «¡PREGUNTA 2 DE N!» con la pregunta en el centro.
- **Disparo**: cada pregunta repite la animación centro → recuadro.
- Retroalimentación solo al final. Avatares corregidos. Créditos con el tema del juego, «Deiwy Mondragon» y citas de Precálculo y Cálculo (Stewart).
- Salas: impostores con Ninguno / Auto / 1 / 2 / 3 y casilla numérica.

## Novedades 1.8.4
- **Tutorial tipo Parchís** (bienvenida → pasos guiados → felicitaciones, con *Omitir*) en los 3 primeros niveles (tablero 1: disparo, carrera, laberinto) y para CADA perfil nuevo, aunque borres el avatar y crees otro.
- **Salas estilo Among Us**: el impostor puede ☠️ *Eliminar* a un tripulante (el villano del tema se lo come con animación); el eliminado sigue viendo la partida como espectador.
- **Votación real**: el más votado sale de la sala (impostor o inocente) con animación del villano y revelación; empate = nadie sale. Los expulsados quedan como espectadores (💀 en el ranking).
- **Ropa gratis solo dentro de la sala** (al salir se recupera la ropa real).
- **50/50** ahora quita 2 respuestas cuando hay 4 (error corregido).

## Novedades 1.8.3
- **Feedback más puntual**: las explicaciones de las 104 familias de preguntas ahora muestran el procedimiento paso a paso con los números de cada ejercicio y el error común.
- **Ruleta**: se quitó el texto de probabilidades (sigue siendo equiprobable).
- **Carrera tipo Subway Surfers**: el héroe corre en línea fija y se mueve exactamente donde pones el dedo; **saltas** minas con el botón *Saltar*, deslizando hacia arriba o con Espacio. Se quitó el botón de saltar pregunta.
- **Pac-Man**: al comer la respuesta correcta se muestra la respuesta y su porqué varios segundos antes de la siguiente fase; al ganar siguen los fantasmas hasta comer todos los puntos; los portales ya no tienen puntos y son 4 (izquierda↔derecha y arriba↔abajo).
- **Ayudas tipo "Quién quiere ser millonario"**: botón *Ayuda* con 50/50 (quita 2 respuestas) y Pista (texto que se cierra al tocarlo o solo).
- **Seguir luchando** arranca directo el siguiente nivel.
- **Mapa**: los nombres de los villanos van al costado del nodo y ya no tapan nada.
- **Salas**: 🚨 reunión de emergencia (una por jugador) que pausa el juego de TODOS y abre la votación al mismo tiempo, como en Among Us.

## Novedades 1.8.2
- **Victoria justa**: hay que acertar al menos la mitad de las preguntas a la primera; en Pac-Man además hay que comer TODOS los puntitos.
- **Pac-Man**: el tablero ya no cambia a mitad de partida; el aviso «Ese no era» es breve (la explicación completa está al final).
- **Carrera**: más lenta, con botón «Saltar» (cuenta como fallada).
- **Ruleta**: las 8 casillas tienen la misma probabilidad (12,5 %) y se muestran claro tus monedas, sigmas y giros.
- **Emotes** en círculo alrededor del personaje (toca al héroe o el botón Emotes). Avatar con más movimiento (brazos, pies, cabeza, parpadeo, saltito y balanceo).
- **Vestidor**: sin cartel grande; el botón Comprar sale dentro de la tarjeta del objeto.
- **Salas**: botones flotantes pequeños y movibles; todos juegan el mismo juego a la vez, con sala de espera y votación de impostor entre juegos; al final se anuncia quién ganó.
- **Tutorial** paso a paso dentro del propio juego.
