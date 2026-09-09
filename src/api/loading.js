// Contador de peticiones HTTP en vuelo.
//
// Es un CONTADOR y no un booleano a propósito: la aplicación dispara varias
// llamadas a la vez —cada pantalla carga sus catálogos al montarse— y con una
// bandera, la primera en responder apagaría el indicador mientras las demás
// siguen esperando.
//
// Vive fuera de React porque quien lo incrementa es el cliente HTTP, que no es
// un componente. Los componentes se suscriben.

/**
 * Rutas que NO encienden el velo, por prefijo.
 *
 * Es el lugar donde declarar las excepciones: una petición se exime por lo
 * que ES, no por quién la llama. Marcarlas una a una en cada módulo dispersa
 * la decisión y la siguiente llamada al mismo endpoint se olvida.
 *
 * Dos motivos legítimos para entrar aquí:
 *   · la pantalla ya tiene su propio indicador y el velo lo taparía
 *   · la petición se dispara sola, sin que el usuario la haya pedido
 */
export const RUTAS_EXENTAS = [
  // El botón de entrar ya muestra su giro; el velo encima lo esconde.
  '/api/auth/login',
  // Se dispara con cada tecla: bloquear la pantalla al escribir es peor que
  // no avisar nada.
  '/api/search',
];

/**
 * Coincide con la ruta exacta o con lo que cuelgue de ella, pero respetando
 * el límite del segmento: '/api/search' NO debe eximir a '/api/searchable',
 * que sería otro endpoint eximido por accidente.
 */
export const estaExenta = (path = '') =>
  RUTAS_EXENTAS.some((r) => path === r || path.startsWith(r + '/') || path.startsWith(r + '?'));

let enVuelo = 0;
const suscriptores = new Set();

function avisar() {
  for (const fn of suscriptores) fn(enVuelo);
}

export function inicioPeticion() {
  enVuelo += 1;
  avisar();
}

export function finPeticion() {
  // Nunca por debajo de cero: un decremento de más —por un doble finally o un
  // aborto— dejaría el contador negativo y el indicador no volvería a salir.
  enVuelo = Math.max(0, enVuelo - 1);
  avisar();
}

export function peticionesEnVuelo() {
  return enVuelo;
}

/** Devuelve la función para desuscribirse. */
export function suscribir(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}
