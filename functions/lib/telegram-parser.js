'use strict';

const TIME_ZONE = 'America/Lima';

const UNIDADES = Object.freeze({
  cero:0, un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
  diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
  veinte:20, veintiuno:21, veintidos:22, veintitres:23, veinticuatro:24, veinticinco:25, veintiseis:26, veintisiete:27,
  veintiocho:28, veintinueve:29, treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90,
  cien:100, ciento:100, doscientos:200, trescientos:300, cuatrocientos:400, quinientos:500, seiscientos:600,
  setecientos:700, ochocientos:800, novecientos:900
});

const PALABRAS_NUMERO = new Set([...Object.keys(UNIDADES), 'y', 'mil']);

function quitarTildes(valor = '') {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizar(valor = '') {
  return quitarTildes(valor)
    .toLowerCase()
    .replace(/[^a-z0-9ñ.,/\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fechaLima(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone:TIME_ZONE,
    year:'numeric', month:'2-digit', day:'2-digit'
  }).format(date);
}

function desplazarFecha(fechaISO, dias) {
  const base = new Date(`${fechaISO}T12:00:00-05:00`);
  base.setDate(base.getDate() + dias);
  return fechaLima(base);
}

function numeroDesdeTokens(tokens = []) {
  let total = 0;
  let actual = 0;
  let encontro = false;

  for (const token of tokens) {
    if (token === 'y') continue;
    if (token === 'mil') {
      total += (actual || 1) * 1000;
      actual = 0;
      encontro = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(UNIDADES, token)) {
      actual += UNIDADES[token];
      encontro = true;
      continue;
    }
    break;
  }

  return encontro ? total + actual : null;
}

function extraerNumeroEnPalabras(textoNormalizado) {
  const tokens = textoNormalizado.split(' ');
  let mejor = null;

  for (let i = 0; i < tokens.length; i += 1) {
    if (!PALABRAS_NUMERO.has(tokens[i])) continue;
    const secuencia = [];
    for (let j = i; j < tokens.length && PALABRAS_NUMERO.has(tokens[j]); j += 1) secuencia.push(tokens[j]);
    const valor = numeroDesdeTokens(secuencia);
    if (valor !== null && valor > 0 && (!mejor || secuencia.length > mejor.longitud)) {
      mejor = { valor, longitud:secuencia.length };
    }
  }

  return mejor?.valor ?? null;
}

function extraerMonto(texto = '') {
  const limpio = normalizar(texto);
  const patrones = [
    /(?:s\/?\.?|soles?)\s*(\d+(?:[.,]\d{1,2})?)/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:soles?|s\/?\.?)\b/i,
    /(?:us\$|\$|dolares?)\s*(\d+(?:[.,]\d{1,2})?)/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:dolares?|us\$|\$)\b/i,
    /\b(\d+(?:[.,]\d{1,2})?)\b/
  ];

  for (const patron of patrones) {
    const match = limpio.match(patron);
    if (!match) continue;
    const valor = Number(String(match[1]).replace(',', '.'));
    if (Number.isFinite(valor) && valor > 0 && valor < 1000000) return Math.round(valor * 100) / 100;
  }

  const palabras = extraerNumeroEnPalabras(limpio);
  return palabras === null ? null : palabras;
}

function detectarMoneda(texto = '') {
  const limpio = normalizar(texto);
  if (/\b(dolar|dolares|usd|us\$)\b|\$/.test(limpio)) return 'USD';
  return 'PEN';
}

function detectarFecha(texto = '', hoy = fechaLima()) {
  const limpio = normalizar(texto);
  if (/\banteayer\b/.test(limpio)) return desplazarFecha(hoy, -2);
  if (/\bayer\b/.test(limpio)) return desplazarFecha(hoy, -1);
  if (/\bmanana\b/.test(limpio)) return desplazarFecha(hoy, 1);

  const iso = limpio.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;

  const diaMes = limpio.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (diaMes) {
    const anio = diaMes[3] || hoy.slice(0, 4);
    return `${anio}-${String(diaMes[2]).padStart(2, '0')}-${String(diaMes[1]).padStart(2, '0')}`;
  }

  return hoy;
}

function detectarTipoMovimiento(texto = '') {
  const limpio = normalizar(texto);
  if (/\b(pague|pago|abone|abono)\b.{0,30}\b(tarjeta|visa|mastercard|american express|amex)\b/.test(limpio)
      || /\b(pago|abono)\s+(?:de|a|para)\s+(?:la\s+)?tarjeta\b/.test(limpio)) return 'pagoTarjeta';
  if (/\b(pague|pago|abone|abono|cuota)\b.{0,30}\b(prestamo|credito yape|adelanto sueldo)\b/.test(limpio)) return 'pagoPrestamo';
  return 'gasto';
}

function detectarMedio(texto = '', tipoMovimiento = 'gasto') {
  const limpio = normalizar(texto);
  if (/\byape\b/.test(limpio)) return 'yape';
  if (/\bplin\b/.test(limpio)) return 'plin';
  if (/\b(efectivo|cash)\b/.test(limpio)) return 'efectivo';
  if (/\b(debito|tarjeta de debito)\b/.test(limpio)) return 'debito';
  if (/\b(tarjeta|credito|visa|mastercard|amex|american express)\b/.test(limpio)) return 'tarjeta';
  if (tipoMovimiento !== 'gasto') return 'transferencia';
  return null;
}

function detectarCategoria(texto = '', tipoMovimiento = 'gasto') {
  if (tipoMovimiento !== 'gasto') return 'Deudas';
  const limpio = normalizar(texto);
  const reglas = [
    ['Alimentación', /\b(supermercado|mercado|metro|plaza vea|tottus|wong|mass|vivanda|pan|comida|almuerzo|cena|desayuno|restaurante|pollo|carne|verdura|fruta|bodega)\b/],
    ['Servicios', /\b(luz|agua|internet|win|movistar|claro|entel|telefono|celular|gas|recibo|servicio)\b/],
    ['Transporte', /\b(pasaje|taxi|uber|indrive|cabify|bus|micro|combustible|gasolina|peaje|estacionamiento)\b/],
    ['Salud', /\b(farmacia|medicina|doctor|doctora|clinica|hospital|consulta|salud|terapia)\b/],
    ['Hogar', /\b(casa|hogar|limpieza|pañal|panal|mueble|ferreteria|alquiler|mantenimiento)\b/],
    ['Entret.', /\b(cine|juego|salida|discoteca|streaming|netflix|hbo|max|spotify|youtube premium|diversion)\b/],
    ['Educación', /\b(colegio|nido|universidad|curso|libro|cuaderno|utiles|matricula|pension)\b/]
  ];
  return reglas.find(([, patron]) => patron.test(limpio))?.[0] || 'Otros';
}

function aliasTarjeta(t = {}) {
  return [t.nombre, t.banco, t.alias, t.marca, t.ultimosDigitos, t.numeroUltimos4]
    .filter(Boolean)
    .map(normalizar)
    .filter(valor => valor.length >= 3);
}

function detectarTarjeta(texto = '', tarjetas = []) {
  const limpio = normalizar(texto);
  let mejor = null;

  for (const tarjeta of tarjetas) {
    let puntaje = 0;
    for (const alias of aliasTarjeta(tarjeta)) {
      if (limpio.includes(alias)) puntaje += Math.max(3, alias.length);
    }
    const nombre = normalizar(tarjeta.nombre || tarjeta.banco || '');
    if (nombre.includes('bcp') && /\bbcp\b/.test(limpio)) puntaje += 10;
    if (nombre.includes('bbva') && /\bbbva\b/.test(limpio)) puntaje += 10;
    if (nombre.includes('ripley') && /\bripley\b/.test(limpio)) puntaje += 10;
    if (nombre.includes('falabella') && /\bfalabella\b/.test(limpio)) puntaje += 10;
    if (nombre.includes('santander') && /\bsantander\b/.test(limpio)) puntaje += 10;
    if (!mejor || puntaje > mejor.puntaje) mejor = { tarjeta, puntaje };
  }

  return mejor && mejor.puntaje > 0 ? mejor.tarjeta : null;
}

function limpiarDescripcion(texto = '', monto = null) {
  let salida = normalizar(texto)
    .replace(/^\/?(?:gasto|gast[eé]|pagu[eé]|compr[eé]|compre|pago|abono)\s+/, '')
    .replace(/\b(hoy|ayer|anteayer)\b/g, ' ')
    .replace(/\b(con|usando|por)\s+(?:la\s+)?(?:tarjeta|visa|mastercard|yape|plin|efectivo|debito|credito)\b.*$/g, ' ')
    .replace(/\b(soles?|dolares?|usd)\b/g, ' ')
    .replace(/\bs\/?\.?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (monto !== null) {
    const montoTexto = String(monto).replace('.', '[.,]');
    salida = salida.replace(new RegExp(`\\b${montoTexto}\\b`), ' ').replace(/\s+/g, ' ').trim();
  }

  const en = salida.match(/\ben\s+(.+)$/);
  if (en?.[1]) salida = en[1].trim();
  salida = salida.replace(/^(en|de|para)\s+/, '').trim();

  if (!salida || salida.length < 2) return null;
  return salida.charAt(0).toUpperCase() + salida.slice(1);
}

function analizarMensaje(texto, { tarjetas = [], hoy = fechaLima() } = {}) {
  const transcripcion = String(texto || '').trim();
  const tipoMovimiento = detectarTipoMovimiento(transcripcion);
  const monto = extraerMonto(transcripcion);
  const moneda = detectarMoneda(transcripcion);
  const fecha = detectarFecha(transcripcion, hoy);
  const medio = detectarMedio(transcripcion, tipoMovimiento);
  const tarjeta = detectarTarjeta(transcripcion, tarjetas);
  const categoriaSugerida = detectarCategoria(transcripcion, tipoMovimiento);
  const descripcion = limpiarDescripcion(transcripcion, monto);

  const camposFaltantes = [];
  if (!(monto > 0)) camposFaltantes.push('monto');
  if (!descripcion) camposFaltantes.push('descripcion');
  if (!medio && tipoMovimiento === 'gasto') camposFaltantes.push('medio');
  if ((medio === 'tarjeta' || tipoMovimiento === 'pagoTarjeta') && !tarjeta) camposFaltantes.push('tarjeta');
  if (categoriaSugerida === 'Otros' && tipoMovimiento === 'gasto') camposFaltantes.push('categoria');

  const totalCampos = 5;
  const resueltos = Math.max(0, totalCampos - camposFaltantes.length);

  return {
    transcripcion,
    tipoMovimiento,
    monto,
    moneda,
    fecha,
    medio,
    tarjetaId:tarjeta?.id || null,
    tarjetaNombre:tarjeta?.nombre || tarjeta?.banco || null,
    categoriaSugerida,
    descripcion,
    camposFaltantes,
    confianza:Math.round((resueltos / totalCampos) * 100)
  };
}

module.exports = Object.freeze({
  normalizar,
  fechaLima,
  extraerMonto,
  detectarMoneda,
  detectarFecha,
  detectarTipoMovimiento,
  detectarMedio,
  detectarCategoria,
  detectarTarjeta,
  limpiarDescripcion,
  analizarMensaje
});