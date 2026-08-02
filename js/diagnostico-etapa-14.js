/* Hogar Finanzas — diagnóstico de la Etapa 14 */
(() => {
  'use strict';
  if (window.HFDiagnosticoEtapa14) return;

  const VERSION = '20.0';
  const prueba = (nombre, condicion, detalle = null) => ({ nombre, ok:Boolean(condicion), detalle:condicion ? null : detalle });

  async function ejecutar() {
    const modulo = window.HFExperienciaFinanciera14;
    const estado = modulo?.obtenerEstado?.() || {};
    const resultados = [
      prueba('Módulo de experiencia financiera disponible', Boolean(modulo), 'No se cargó HFExperienciaFinanciera14'),
      prueba('Resumen sin bloque editorial del mes', estado.estadoMesOculto, 'El bloque estado-mes continúa visible'),
      prueba('Movimientos con diseño legible', estado.movimientosMejorados && Boolean(document.querySelector('.hf-movement-card, #expenseList')), 'No se instaló el nuevo render de movimientos'),
      prueba('Encabezado redundante de deudas retirado', !document.querySelector('#hf-family-debt-view .hf-family-debt-head:not([hidden])'), 'Sigue visible “Así están nuestras deudas”'),
      prueba('Alertas redundantes de deudas retiradas', !document.querySelector('#hf-family-debt-view .hf-family-priority:not([hidden])'), 'Sigue visible “Lo que necesita atención”'),
      prueba('Formulario de tarjeta con TEA y fechas', estado.formularioTarjetaCompleto, 'Faltan TEA o fechas exactas en la tarjeta'),
      prueba('Pago de tarjeta permite confirmar disponible', estado.campoDisponiblePago, 'Falta el nuevo disponible según el banco'),
      prueba('Centro de estados mensuales disponible', estado.centroEstados, 'No se crearon los modales de estados'),
      prueba('Administración de deudas simplificada', estado.adminSimplificado && !document.querySelector('#hfDebtAdminModal [data-admin-action="actualizar"], #hfDebtAdminModal [data-admin-action="cierre"]'), 'Continúan las acciones antiguas'),
      prueba('Tarjetas y préstamos con acciones directas', estado.accionesDeuda > 0 || !document.querySelector('#hf-family-debt-view .hf-family-card'), 'No se añadieron botones de administración a las deudas'),
      prueba('Secretos y credenciales ausentes del cliente', ![...document.scripts].some(s => /TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK_SECRET/.test(s.textContent || '')), 'Se detectó una referencia sensible en scripts del cliente')
    ];
    const aprobadas = resultados.filter(r => r.ok).length;
    const salida = { fecha:new Date().toISOString(), version:VERSION, aprobadas, total:resultados.length, listo:aprobadas === resultados.length, pruebas:resultados };
    console.log(`Hogar Finanzas · etapa 14 ${salida.listo ? 'APROBADA' : 'CON INCIDENCIAS'}`);
    console.table(resultados);
    return salida;
  }

  window.HFDiagnosticoEtapa14 = Object.freeze({ ejecutar, version:VERSION });
})();