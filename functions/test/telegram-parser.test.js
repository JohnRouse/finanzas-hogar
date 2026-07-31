'use strict';

const assert = require('assert');
const { analizarMensaje, extraerMonto } = require('../lib/telegram-parser');

const tarjetas = [
  { id:'bcp', nombre:'Visa BCP' },
  { id:'bbva', nombre:'Visa BBVA' }
];

const gasto = analizarMensaje('Gasté 35 soles en Metro con la Visa BCP hoy', { tarjetas, hoy:'2026-07-31' });
assert.strictEqual(gasto.monto, 35);
assert.strictEqual(gasto.moneda, 'PEN');
assert.strictEqual(gasto.medio, 'tarjeta');
assert.strictEqual(gasto.tarjetaId, 'bcp');
assert.strictEqual(gasto.categoriaSugerida, 'Alimentación');

const pago = analizarMensaje('Pagué 300 soles a la tarjeta Visa BBVA', { tarjetas, hoy:'2026-07-31' });
assert.strictEqual(pago.tipoMovimiento, 'pagoTarjeta');
assert.strictEqual(pago.tarjetaId, 'bbva');

assert.strictEqual(extraerMonto('Gasté treinta y cinco soles en pan'), 35);
assert.strictEqual(extraerMonto('Pagué 89,90 soles de internet'), 89.9);

console.log('Pruebas del parser de Telegram: OK');