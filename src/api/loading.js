// Contador de peticiones HTTP en vuelo.
//
// Es un CONTADOR y no un booleano a propósito: la aplicación dispara varias
// llamadas a la vez —cada pantalla carga sus catálogos al montarse— y con una
// bandera, la primera en responder apagaría el indicador mientras las demás
// siguen esperando.
//
// Vive fuera de React porque quien lo incrementa es el cliente HTTP, que no es
// un componente. Los componentes se suscriben.

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
