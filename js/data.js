/* DuiX — datos del juego: villanos, repaso, tienda, logros */
(function (root) {
  'use strict';

  /* ---------- Villanos / distritos (uno por tema) ---------- */
  const VILLAINS = [
    {
      id: 'intervalos', n: 1, topic: 'intervalos', name: 'Corchetto', title: 'Señor de los Extremos', district: 'Muelle de los Extremos', tema: 'Intervalos',
      body: 'brute', glyph: '[ )', pal: { main: '#2bb3a3', shade: '#177a70', light: '#7ff0dd', accent: '#ffd23f', eye: '#ff4d4d' }, sky: ['#0d2a4a', '#1c6f8f'], glow: '#2bb3a3',
      intro: '¡Nadie cruza mis fronteras! Yo decido quién entra al intervalo… y quién se queda afuera.',
      defeat: 'Mis extremos… ¡estaban abiertos todo el tiempo!',
    },
    {
      id: 'fracciones', n: 2, topic: 'fracciones', name: 'Don Quebrado', title: 'El Partido en Dos', district: 'Mercado Fraccionado', tema: 'Operaciones con fracciones',
      body: 'blob', glyph: '½', pal: { main: '#ff8fa3', shade: '#c9486a', light: '#ffd0da', accent: '#ffe066', eye: '#3a0f26' }, sky: ['#3a1230', '#a8456b'], glow: '#ff8fa3',
      intro: 'Te voy a romper en pedacitos… ¡y sin común denominador!',
      defeat: 'Me… me simplificaron a la mínima expresión.',
    },
    {
      id: 'factorizacion', n: 3, topic: 'factorizacion', name: 'Primo Rex', title: 'El Desarmador', district: 'Fábrica de Factores', tema: 'Factorización',
      body: 'dino', glyph: '(·)(·)', pal: { main: '#63c132', shade: '#3a7d1a', light: '#b6f27a', accent: '#ff7b00', eye: '#ffef5c' }, sky: ['#14300f', '#4b8a2a'], glow: '#63c132',
      intro: '¡RAAAWR! Todo número se rompe en primos… ¡y tú serás el siguiente!',
      defeat: 'Me descompusieron… en factores primos.',
    },
    {
      id: 'polinomios', n: 4, topic: 'polinomios', name: 'Polinomiaca', title: 'La de Mil Términos', district: 'Torre de los Mil Términos', tema: 'Operaciones entre polinomios',
      body: 'witch', glyph: 'xⁿ', pal: { main: '#9b5de5', shade: '#5f2fa0', light: '#d3b0ff', accent: '#f15bb5', eye: '#fff275' }, sky: ['#1d0f3d', '#6a3fb5'], glow: '#9b5de5',
      intro: 'Sumo, resto, multiplico… ¡y cada término que te toque será tu perdición!',
      defeat: 'Mis términos semejantes… ¡se han cancelado!',
    },
    {
      id: 'plano', n: 5, topic: 'plano', name: 'Lord Descartes', title: 'El Descartado', district: 'Plaza Cartesiana', tema: 'Plano cartesiano',
      body: 'gentleman', glyph: '(x,y)', pal: { main: '#e4c9a3', shade: '#a98453', light: '#fff0d6', accent: '#2f6bff', eye: '#1a1033' }, sky: ['#10233f', '#3a6ea5'], glow: '#4da3ff',
      intro: 'Yo inventé el plano. Cada punto de esta ciudad tiene su lugar… y el tuyo es la derrota.',
      defeat: 'Descartado… otra vez. ¡Qué irónico!',
    },
    {
      id: 'desigualdades', n: 6, topic: 'desigualdades', name: 'Cocodrilo Desigual', title: 'La Boca que Devora', district: 'Pantano de la Boca Abierta', tema: 'Desigualdades',
      body: 'croc', glyph: '<', pal: { main: '#4cbb17', shade: '#2a7a0b', light: '#a8f072', accent: '#ffd23f', eye: '#ffcf33' }, sky: ['#0d2a17', '#2f7d3a'], glow: '#4cbb17',
      intro: '¡ÑAM! Siempre me como al número más grande. ¿Cuál será el tuyo?',
      defeat: 'Me dieron la vuelta… ¡y cambié de sentido!',
    },
    {
      id: 'funciones', n: 7, topic: 'funciones', name: 'F-9000', title: 'La Máquina Entra-Sale', district: 'Laboratorio Entra-Sale', tema: 'Funciones y operaciones entre funciones',
      body: 'robot', glyph: 'f(x)', pal: { main: '#b8c4d6', shade: '#6f7f99', light: '#f0f5ff', accent: '#ff3b3b', eye: '#ff3b3b' }, sky: ['#0b1424', '#2b4a78'], glow: '#7db2ff',
      intro: 'ENTRADA DETECTADA. SALIDA ÚNICA GARANTIZADA. RESISTENCIA: INÚTIL.',
      defeat: 'ERROR… dos salidas para una misma entrada…',
    },
    {
      id: 'desplazamientos', n: 8, topic: 'desplazamientos', name: 'Fantasma Desfase', title: 'El que Mueve Todo', district: 'Cementerio de las Traslaciones', tema: 'Desplazamientos en el plano',
      body: 'ghost', glyph: '→↑', pal: { main: '#d9e4ff', shade: '#8ea3d9', light: '#ffffff', accent: '#5ce1e6', eye: '#1a1033' }, sky: ['#141033', '#4b3f8f'], glow: '#9ab0ff',
      intro: 'Uuuh… muevo tu gráfica a la izquierda… ¡pero parece que va a la derecha!',
      defeat: 'Me… reflejaron… en el eje equivocado…',
    },
    {
      id: 'tabulaciones', n: 9, topic: 'tabulaciones', name: 'Tabulón', title: 'El Tirano de la Tabla', district: 'Bulevar de las Tablas', tema: 'Tabulaciones',
      body: 'tower', glyph: 'x|y', pal: { main: '#f4a259', shade: '#b8672a', light: '#ffd9aa', accent: '#2e2a5b', eye: '#2e2a5b' }, sky: ['#2b1a0d', '#a8642a'], glow: '#f4a259',
      intro: 'Cada fila, cada columna… ¡todo en orden o te encierro en mi tabla!',
      defeat: 'Mi tabla… ¡se quedó sin filas!',
    },
    {
      id: 'potenciacion', n: 10, topic: 'potenciacion', name: 'Potentor', title: 'El Elevado', district: 'Gimnasio Exponencial', tema: 'Potenciación',
      body: 'muscle', glyph: 'xⁿ', pal: { main: '#ef476f', shade: '#a12244', light: '#ff9db5', accent: '#ffd166', eye: '#fff275' }, sky: ['#2a0a17', '#a3294a'], glow: '#ef476f',
      intro: '¡Mis músculos crecen EXPONENCIALMENTE! ¿Cuánto es 2 elevado a mi poder?',
      defeat: 'Mi exponente… ¡se hizo cero!',
    },
    {
      id: 'composicion', n: 11, topic: 'composicion', name: 'Matrioska', title: 'La Compuesta', district: 'Bazar de Muñecas Rusas', tema: 'Composición de funciones',
      body: 'egg', glyph: 'f∘g', pal: { main: '#e63946', shade: '#9d1d2a', light: '#ff8a93', accent: '#ffd166', eye: '#1a1033' }, sky: ['#2a1020', '#8a2c4a'], glow: '#ff5d6c',
      intro: 'Dentro de mí hay otra… y dentro de ella, otra más. ¡Primero g, después f!',
      defeat: 'Me abrieron… ¡y ya no quedaba nadie adentro!',
    },
    {
      id: 'radicales', n: 12, topic: 'radicales', name: 'Raizón', title: 'El Radical', district: 'Mina Radical', tema: 'Exponentes y radicales',
      body: 'miner', glyph: '√', pal: { main: '#a67c52', shade: '#6b4a2a', light: '#d9b48a', accent: '#ffd23f', eye: '#fff275' }, sky: ['#1b120a', '#5b3d22'], glow: '#d9a05b',
      intro: 'Vivo bajo tierra, en la raíz de todos los problemas. ¡Ven a sacarme si puedes!',
      defeat: 'Me racionalizaron… ¡sin dejarme raíz en el denominador!',
    },
    {
      id: 'logaritmos', n: 13, topic: 'logaritmos', name: 'Logarritmia', title: 'La Deshacedora de Potencias', district: 'Puerto del Log', tema: 'Logaritmos y funciones inversas',
      body: 'squid', glyph: 'log', pal: { main: '#3a86ff', shade: '#1b4aa8', light: '#8ec0ff', accent: '#ffbe0b', eye: '#fff275' }, sky: ['#04122e', '#0c4c8f'], glow: '#3a86ff',
      intro: 'Deshago tus potencias como la marea deshace la arena. ¿A qué exponente vas a caer?',
      defeat: 'Mi inversa… ¡me devolvió al principio!',
    },
    {
      id: 'trigonometria', n: 14, topic: 'trigonometria', name: 'Tangenta', title: 'Reina de las Ondas', district: 'Observatorio de las Ondas', tema: 'Funciones trigonométricas',
      body: 'queen', glyph: 'sen', pal: { main: '#f8c8ff', shade: '#b158c9', light: '#ffeaff', accent: '#ffd166', eye: '#7a1fa2' }, sky: ['#170a33', '#7a3fa8'], glow: '#e07cff',
      intro: 'Subo, bajo, me repito cada 2π. ¡Ninguna onda escapa de mi corona!',
      defeat: 'Mi período… ¡se acabó!',
    },
    {
      id: 'indeterminado', n: 15, topic: 'mix', name: 'El Indeterminado', title: 'El Jefe del Vacío', district: 'El Vacío 0/0', tema: 'Todos los temas',
      body: 'void', glyph: '0/0', pal: { main: '#2a1a4a', shade: '#100a20', light: '#7a4fd1', accent: '#ff3b6b', eye: '#ff3b6b' }, sky: ['#000000', '#2a0a3d'], glow: '#b14cff', boss: true,
      intro: 'Nací de dividir entre cero. Ni valgo algo… ni valgo nada. ¡Y voy a borrarte de esta ciudad!',
      defeat: 'Detrás de mí… ¡alguien más movía los hilos!',
    },
    {
      id: 'duinity', n: 16, topic: 'mix', name: 'Duinity', title: 'El Infinito', district: 'Dimensión Infinita', tema: 'Modo Duinity (sin fin)',
      body: 'king', glyph: '∞', pal: { main: '#ffd23f', shade: '#c98900', light: '#fff2a8', accent: '#ff3b6b', eye: '#2a0a3d' }, sky: ['#0a0020', '#4a1a8f'], glow: '#ffd23f', boss: true, endless: true,
      intro: 'Yo soy el límite al que nadie llega. ¿Cuánto puedes resistir contra el infinito?',
      defeat: '¡Imposible… llegaste hasta donde yo no acababa!',
    },
  ];

  /* ---------- Repaso rápido por tema ---------- */
  const REPASO = {
    intervalos: [
      '[a, b] incluye a y b (cerrado). (a, b) los excluye (abierto).',
      '≤ y ≥ llevan corchete. < y > llevan paréntesis.',
      '∞ y −∞ siempre llevan paréntesis.',
      'A ∪ B = todo lo que está en A o en B.  A ∩ B = lo que está en ambos.',
      'Ejemplo:  −2 < x ≤ 5  se escribe  (−2, 5].',
    ],
    fracciones: [
      'a/b + c/d = (a·d + b·c) / (b·d). Nunca sumes los denominadores.',
      'a/b × c/d = (a·c) / (b·d).',
      'a/b ÷ c/d = a/b × d/c  (multiplica por el inverso).',
      'Simplifica dividiendo arriba y abajo entre su máximo común divisor.',
      'Opera primero los paréntesis.',
    ],
    factorizacion: [
      'Siempre empieza por el factor común.',
      'a² − b² = (a − b)(a + b).',
      'x² + (p + q)x + pq = (x + p)(x + q).',
      'a² ± 2ab + b² = (a ± b)².',
      'a³ ± b³ = (a ± b)(a² ∓ ab + b²).',
      'Agrupación: saca factor común por parejas de términos.',
    ],
    polinomios: [
      'Suma y resta: combina términos semejantes. Un “−” delante del paréntesis cambia TODOS los signos.',
      'Producto: distribuye cada término (FOIL para binomios).',
      'grado(P · Q) = grado(P) + grado(Q).',
      'Teorema del residuo: el residuo de P(x) ÷ (x − a) es P(a).',
      'División sintética: usa x = a como pivote.',
    ],
    plano: [
      'Cuadrantes: I (+,+)  II (−,+)  III (−,−)  IV (+,−).',
      'Distancia: d = √[(x₂ − x₁)² + (y₂ − y₁)²].',
      'Punto medio: ((x₁ + x₂)/2 , (y₁ + y₂)/2).',
      'Pendiente: m = (y₂ − y₁)/(x₂ − x₁).  Recta: y = mx + b.',
      'Reflexión: en el eje x cambia y; en el eje y cambia x; en el origen cambian ambos.',
    ],
    desigualdades: [
      'Al multiplicar o dividir por un número NEGATIVO, la desigualdad se invierte.',
      '|u| < b  ⇒  −b < u < b  (una sola región).',
      '|u| > b  ⇒  u < −b  o  u > b  (dos regiones).',
      'Cuadráticas: halla las raíces y analiza el signo en cada zona.',
      'Escribe la respuesta en notación de intervalo.',
    ],
    funciones: [
      'f(a): reemplaza x por a y calcula.',
      'Dominio: el radicando (raíz par) debe ser ≥ 0 y el denominador ≠ 0.',
      '(f ± g)(x) = f(x) ± g(x)   (f·g)(x) = f(x)·g(x)   (f/g)(x) = f(x)/g(x), con g(x) ≠ 0.',
      'Función: cada x tiene UNA sola y.',
      'Rango: todos los valores que toma y.',
    ],
    desplazamientos: [
      'y = f(x − h) desplaza h a la derecha; f(x + h) a la izquierda.',
      'y = f(x) + k sube k; y = f(x) − k baja k.',
      'y = −f(x) refleja en el eje x; y = f(−x) refleja en el eje y.',
      'y = c·f(x) estira en vertical; y = f(cx) comprime en horizontal.',
      'El vértice de y = (x − h)² + k es (h, k).',
    ],
    tabulaciones: [
      'Tabular es evaluar la función en varios valores de x y ordenar los pares (x, y).',
      'Lineal: y cambia siempre lo mismo cuando x sube 1 (esa es la pendiente).',
      'En x = 0 la tabla muestra la ordenada al origen b.',
      'Cuadrática: los cambios de y no son constantes y hay simetría.',
      'Para hallar x dado y: iguala la fórmula a y y despeja.',
    ],
    potenciacion: [
      'xᵐ · xⁿ = xᵐ⁺ⁿ    xᵐ / xⁿ = xᵐ⁻ⁿ    (xᵐ)ⁿ = xᵐⁿ.',
      '(ab)ⁿ = aⁿ · bⁿ.',
      'x⁰ = 1    x⁻ⁿ = 1/xⁿ    (a/b)⁻ⁿ = (b/a)ⁿ.',
      'Cuidado: −3² = −9  pero  (−3)² = 9.',
      'El exponente solo afecta a lo que está inmediatamente antes.',
    ],
    composicion: [
      '(f ∘ g)(x) = f(g(x)): primero g, después f.',
      'En general f ∘ g ≠ g ∘ f.',
      'Numérica: calcula g(a) y evalúa ese resultado en f.',
      'Simbólica: reemplaza cada x de f por la expresión completa de g.',
      '(x + m)² = x² + 2mx + m²  (no olvides el término del medio).',
      'Descomponer: g es lo que se hace primero (interior); f, lo que se hace después.',
    ],
    radicales: [
      '√(ab) = √a · √b    √(a²) = |a|.',
      'ⁿ√(xᵐ) = x^(m/n): el índice es el denominador del exponente.',
      'Simplifica sacando cuadrados perfectos: √72 = √(36·2) = 6√2.',
      'Racionalizar: c/√b = c√b / b.',
      'Solo se suman radicales semejantes: 3√5 + 2√5 = 5√5.',
    ],
    logaritmos: [
      'log_b x = y  ⇔  bʸ = x.',
      'log(ab) = log a + log b    log(a/b) = log a − log b    log aⁿ = n · log a.',
      'log_b b = 1    log_b 1 = 0    ln e = 1.',
      'Inversa f⁻¹: escribe y = f(x), intercambia x e y y despeja.',
      'Uno a uno = pasa la prueba de la recta horizontal.',
      'bˣ y log_b x son inversas; eˣ y ln x también.',
    ],
    trigonometria: [
      '180° = π rad. De grados a radianes: × π/180.',
      'sen = opuesto/hipotenusa    cos = adyacente/hipotenusa    tan = opuesto/adyacente.',
      'sen 30° = 1/2    sen 45° = √2/2    sen 60° = √3/2 (cos es al revés).',
      'sen²θ + cos²θ = 1.',
      'Signos: I todas +, II solo sen, III solo tan, IV solo cos.',
      'y = A·sen(Bx): amplitud |A|, período 2π/|B|.',
    ],
    mix: [
      'Aquí entran TODOS los temas: intervalos, fracciones, factorización, polinomios, plano, desigualdades, funciones, desplazamientos, tablas, potencias, composición, radicales, logaritmos y trigonometría.',
      'Lee con calma cada pregunta y descarta opciones absurdas.',
      'Usa las pistas y tu Superpoder cuando lo necesites.',
    ],
  };

  /* ---------- Tienda / vestidor ---------- */
  const RARITY = { comun: { name: 'Común', color: '#9fb3c8' }, raro: { name: 'Raro', color: '#4da3ff' }, epico: { name: 'Épico', color: '#c77dff' }, legendario: { name: 'Legendario', color: '#ffc933' } };

  const CATS = [
    { id: 'suit', name: 'Traje', icon: '👕' },
    { id: 'mask', name: 'Máscara', icon: '🎭' },
    { id: 'cape', name: 'Capa', icon: '🧣' },
    { id: 'emblem', name: 'Emblema', icon: '⭐' },
    { id: 'weapon', name: 'Arma', icon: '⚡' },
    { id: 'amulet', name: 'Amuleto', icon: '🛡️' },
  ];

  const ITEMS = [
    // ---- Trajes
    { id: 'suit-rojo', cat: 'suit', name: 'Rojo Héroe', rarity: 'comun', price: 0, main: '#e63946', shade: '#9d1d2a', accent: '#ffd23f' },
    { id: 'suit-azul', cat: 'suit', name: 'Azul Límite', rarity: 'comun', price: 0, main: '#2f6bff', shade: '#1b3ea8', accent: '#ffffff' },
    { id: 'suit-verde', cat: 'suit', name: 'Verde Radical', rarity: 'comun', price: 60, main: '#2ecc71', shade: '#1a8a4a', accent: '#ffe66d' },
    { id: 'suit-rosa', cat: 'suit', name: 'Rosa Fucsia', rarity: 'comun', price: 60, main: '#ff4fa3', shade: '#b62a72', accent: '#ffffff' },
    { id: 'suit-morado', cat: 'suit', name: 'Morado Nova', rarity: 'raro', price: 90, main: '#8e44ff', shade: '#5a24b0', accent: '#ff7ad9' },
    { id: 'suit-naranja', cat: 'suit', name: 'Naranja Solar', rarity: 'raro', price: 90, main: '#ff8a1f', shade: '#c25a00', accent: '#3b1a00' },
    { id: 'suit-negro', cat: 'suit', name: 'Negro Sombra', rarity: 'raro', price: 150, main: '#2b2d42', shade: '#14151f', accent: '#ff3b3b' },
    { id: 'suit-cian', cat: 'suit', name: 'Cian Cuántico', rarity: 'epico', price: 240, main: '#16d5d5', shade: '#0b8f96', accent: '#ffffff' },
    { id: 'suit-plata', cat: 'suit', name: 'Plata Vectorial', rarity: 'epico', price: 300, main: '#cfd8e6', shade: '#8a97ad', accent: '#2f6bff' },
    { id: 'suit-dorado', cat: 'suit', name: 'Dorado Sigma', rarity: 'legendario', price: 650, main: '#ffc933', shade: '#c98900', accent: '#ffffff' },
    // ---- Máscaras
    { id: 'mask-none', cat: 'mask', name: 'Sin máscara', rarity: 'comun', price: 0 },
    { id: 'mask-antifaz', cat: 'mask', name: 'Antifaz', rarity: 'comun', price: 0 },
    { id: 'mask-gafas', cat: 'mask', name: 'Gafas de Laboratorio', rarity: 'comun', price: 70 },
    { id: 'mask-visor', cat: 'mask', name: 'Visor Cyber', rarity: 'raro', price: 100 },
    { id: 'mask-gato', cat: 'mask', name: 'Máscara Felina', rarity: 'raro', price: 120 },
    { id: 'mask-ninja', cat: 'mask', name: 'Capucha Ninja', rarity: 'raro', price: 140 },
    { id: 'mask-robot', cat: 'mask', name: 'Casco Robot', rarity: 'epico', price: 260 },
    { id: 'mask-corona', cat: 'mask', name: 'Corona Infinita', rarity: 'legendario', price: 700 },
    // ---- Capas
    { id: 'cape-none', cat: 'cape', name: 'Sin capa', rarity: 'comun', price: 0 },
    { id: 'cape-corta', cat: 'cape', name: 'Capa Corta', rarity: 'comun', price: 0, style: 'short', c1: '#d62839', c2: '#8c1a26' },
    { id: 'cape-larga-azul', cat: 'cape', name: 'Capa Larga Azul', rarity: 'comun', price: 50, style: 'long', c1: '#2f6bff', c2: '#1b3ea8' },
    { id: 'cape-larga-negra', cat: 'cape', name: 'Capa de Medianoche', rarity: 'raro', price: 110, style: 'long', c1: '#2b2d42', c2: '#12131d' },
    { id: 'cape-alas', cat: 'cape', name: 'Alas de Murciélago', rarity: 'epico', price: 280, style: 'wings', c1: '#4a3a6b', c2: '#221a38' },
    { id: 'cape-dorada', cat: 'cape', name: 'Capa Dorada', rarity: 'epico', price: 320, style: 'long', c1: '#ffc933', c2: '#c98900' },
    { id: 'cape-fuego', cat: 'cape', name: 'Capa de Fuego', rarity: 'legendario', price: 700, style: 'flame', c1: '#ff7b00', c2: '#ff3b1f' },
    // ---- Emblemas
    { id: 'emb-star', cat: 'emblem', name: 'Estrella', rarity: 'comun', price: 0, shape: 'star' },
    { id: 'emb-bolt', cat: 'emblem', name: 'Rayo', rarity: 'comun', price: 0, shape: 'bolt' },
    { id: 'emb-heart', cat: 'emblem', name: 'Corazón', rarity: 'comun', price: 40, shape: 'heart' },
    { id: 'emb-inf', cat: 'emblem', name: 'Infinito ∞', rarity: 'comun', price: 60, shape: 'inf' },
    { id: 'emb-pi', cat: 'emblem', name: 'Pi π', rarity: 'raro', price: 80, shape: 'pi' },
    { id: 'emb-sigma', cat: 'emblem', name: 'Sigma Σ', rarity: 'raro', price: 100, shape: 'sigma' },
    { id: 'emb-root', cat: 'emblem', name: 'Raíz √', rarity: 'raro', price: 100, shape: 'root' },
    { id: 'emb-flame', cat: 'emblem', name: 'Llama', rarity: 'epico', price: 160, shape: 'flame' },
    { id: 'emb-deriv', cat: 'emblem', name: 'Derivada f′', rarity: 'epico', price: 240, shape: 'deriv' },
    { id: 'emb-zero', cat: 'emblem', name: 'Indeterminado 0/0', rarity: 'legendario', price: 0, shape: 'zero', unlock: { ach: 'indeterminado' } },
    // ---- Armas (estilo de disparo)
    { id: 'wp-rayo', cat: 'weapon', name: 'Rayo Básico', rarity: 'comun', price: 0, fx: 'bolt', c1: '#ffe14a', c2: '#ff9f1c' },
    { id: 'wp-plasma', cat: 'weapon', name: 'Plasma Cian', rarity: 'raro', price: 90, fx: 'orb', c1: '#5ce1e6', c2: '#1b8fb3' },
    { id: 'wp-fuego', cat: 'weapon', name: 'Bola de Fuego', rarity: 'raro', price: 150, fx: 'fire', c1: '#ffb01f', c2: '#ff3b1f' },
    { id: 'wp-hielo', cat: 'weapon', name: 'Cristal de Hielo', rarity: 'raro', price: 150, fx: 'ice', c1: '#d7f3ff', c2: '#66c8ff' },
    { id: 'wp-parabola', cat: 'weapon', name: 'Rayo Parabólico', rarity: 'epico', price: 300, fx: 'wave', c1: '#b980ff', c2: '#ff7ad9' },
    { id: 'wp-doble', cat: 'weapon', name: 'Láser Doble', rarity: 'epico', price: 350, fx: 'double', c1: '#7dff8a', c2: '#1fbf4a' },
    { id: 'wp-arcoiris', cat: 'weapon', name: 'Arcoíris Infinito', rarity: 'legendario', price: 800, fx: 'rainbow', c1: '#ff4d6d', c2: '#4da3ff' },
    { id: 'wp-duinity', cat: 'weapon', name: 'Rayo Duinity', rarity: 'legendario', price: 0, fx: 'rainbow', c1: '#ffd23f', c2: '#ff3b6b', unlock: { ach: 'duinity' } },
    // ---- Amuletos (con ventaja)
    { id: 'am-none', cat: 'amulet', name: 'Sin amuleto', rarity: 'comun', price: 0, perk: 'Sin efecto.' },
    { id: 'am-escudo', cat: 'amulet', name: 'Escudo de Intervalos', rarity: 'raro', price: 200, perk: '+1 vida al empezar cada batalla.', hearts: 1 },
    { id: 'am-lupa', cat: 'amulet', name: 'Lupa Cartesiana', rarity: 'raro', price: 150, perk: 'Las pistas cuestan la mitad.', hintCost: 0.5 },
    { id: 'am-log', cat: 'amulet', name: 'Amuleto Logarítmico', rarity: 'epico', price: 300, perk: '+15% de monedas.', coins: 0.15 },
    { id: 'am-reloj', cat: 'amulet', name: 'Reloj de Arena', rarity: 'epico', price: 350, perk: 'Las respuestas caen 15% más lento.', slow: 0.15 },
    { id: 'am-titan', cat: 'amulet', name: 'Corazón de Titán', rarity: 'legendario', price: 700, perk: '+1 vida y ignora el primer golpe de cada batalla.', hearts: 1, shield: 1 },
  ];
  const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

  const SKINS = ['#ffdcb8', '#f5c193', '#d9a066', '#b97a4a', '#8a5533', '#5c3720'];
  const HAIR_COLORS = ['#1a1033', '#4a2c17', '#a0522d', '#e8c15a', '#d64545', '#3aa0ff', '#9b5de5', '#f2f2f2'];
  const HAIR_STYLES = [{ id: 'corto', name: 'Corto' }, { id: 'pinchos', name: 'Pinchos' }, { id: 'largo', name: 'Largo' }, { id: 'afro', name: 'Afro' }, { id: 'cresta', name: 'Cresta' }, { id: 'calvo', name: 'Calvo' }];

  /* ---------- Logros ---------- */
  // check(stats, save) => progreso actual (número); goal = meta
  const ACH = [
    { id: 'primera', name: 'Primera victoria', desc: 'Derrota a tu primer villano.', goal: 1, prog: (s) => s.wins, coins: 30 },
    { id: 'diez', name: 'Calentando motores', desc: 'Responde 50 preguntas bien.', goal: 50, prog: (s) => s.correct, coins: 40 },
    { id: 'cien', name: 'Cerebro en llamas', desc: 'Responde 250 preguntas bien.', goal: 250, prog: (s) => s.correct, coins: 100, item: 'emb-heart' },
    { id: 'mil', name: 'Enciclopedia andante', desc: 'Responde 1000 preguntas bien.', goal: 1000, prog: (s) => s.correct, coins: 400, item: 'suit-plata' },
    { id: 'racha5', name: 'En racha', desc: 'Logra una racha de 5 aciertos.', goal: 5, prog: (s) => s.bestStreak, coins: 25 },
    { id: 'racha12', name: 'Imparable', desc: 'Logra una racha de 12 aciertos.', goal: 12, prog: (s) => s.bestStreak, coins: 80, item: 'wp-plasma' },
    { id: 'racha25', name: 'Máquina de límites', desc: 'Logra una racha de 25 aciertos.', goal: 25, prog: (s) => s.bestStreak, coins: 200 },
    { id: 'villanos5', name: 'Cazador de villanos', desc: 'Derrota a 5 villanos distintos.', goal: 5, prog: (s) => s.districts, coins: 60 },
    { id: 'villanos14', name: 'Guardián de la Ciudad', desc: 'Derrota a los 14 villanos.', goal: 14, prog: (s) => s.districts, coins: 250, item: 'mask-visor' },
    { id: 'perfecto', name: 'Sin rasguños', desc: 'Gana una batalla sin perder ninguna vida.', goal: 1, prog: (s) => s.perfect, coins: 40 },
    { id: 'perfecto5', name: 'Intocable', desc: 'Gana 5 batallas sin perder ninguna vida.', goal: 5, prog: (s) => s.perfect, coins: 150, item: 'cape-larga-negra' },
    { id: 'estrellas', name: 'Coleccionista de estrellas', desc: 'Consigue 25 estrellas en total.', goal: 25, prog: (s) => s.stars, coins: 100 },
    { id: 'estrellas42', name: 'Cielo despejado', desc: 'Consigue las 42 estrellas del mapa.', goal: 42, prog: (s) => s.stars, coins: 400, item: 'suit-dorado' },
    { id: 'heroico', name: 'Modo heroico', desc: 'Gana en dificultad Difícil.', goal: 1, prog: (s) => s.hardWins, coins: 80 },
    { id: 'nivel5', name: 'Héroe en ascenso', desc: 'Llega al nivel 5.', goal: 5, prog: (s) => s.level, coins: 60 },
    { id: 'nivel10', name: 'Leyenda de Ciudad Límite', desc: 'Llega al nivel 10.', goal: 10, prog: (s) => s.level, coins: 200 },
    { id: 'tienda', name: 'De compras', desc: 'Compra tu primer objeto.', goal: 1, prog: (s) => s.purchases, coins: 20 },
    { id: 'coleccion', name: 'Guardarropa heroico', desc: 'Ten 15 objetos en tu colección.', goal: 15, prog: (s) => s.owned, coins: 120 },
    { id: 'indeterminado', name: 'Dividido por cero', desc: 'Derrota a El Indeterminado.', goal: 1, prog: (s) => s.boss, coins: 300 },
    { id: 'duinity', name: 'Más allá del infinito', desc: 'Llega a 25 respuestas correctas en el modo Duinity.', goal: 25, prog: (s) => s.duinityBest, coins: 500 },
  ];

  /* ---------- Misiones diarias ---------- */
  const MISSIONS = [
    { id: 'm-correct15', name: 'Responde 15 preguntas bien', goal: 15, stat: 'correct', reward: 30 },
    { id: 'm-correct30', name: 'Responde 30 preguntas bien', goal: 30, stat: 'correct', reward: 55 },
    { id: 'm-streak5', name: 'Logra una racha de 5', goal: 5, stat: 'streak', reward: 30 },
    { id: 'm-win2', name: 'Gana 2 batallas', goal: 2, stat: 'wins', reward: 45 },
    { id: 'm-win1', name: 'Gana 1 batalla', goal: 1, stat: 'wins', reward: 25 },
    { id: 'm-perfect', name: 'Gana una batalla sin perder vidas', goal: 1, stat: 'perfect', reward: 50 },
    { id: 'm-districts2', name: 'Juega 2 distritos distintos', goal: 2, stat: 'districts', reward: 35 },
  ];

  const DATA = { VILLAINS, REPASO, RARITY, CATS, ITEMS, ITEM_BY_ID, SKINS, HAIR_COLORS, HAIR_STYLES, ACH, MISSIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA; else root.DuiXData = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
