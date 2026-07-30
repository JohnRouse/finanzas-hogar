/* Hogar Finanzas — Etapa 11.2.4: reglas bancarias */
(() => {
  'use strict';

  const limpiar = valor => String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const texto = correo => limpiar([
    correo.asunto,
    correo.subject,
    correo.remitente,
    correo.from,
    correo.cuerpo,
    correo.body,
    correo.html,
    correo.texto
  ].filter(Boolean).join(' '));

  function numeroMonetario(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const normalizado = String(valor)
      .replace(/S\/?\.?|US\$|USD|PEN|\$/gi, '')
      .replace(/\s/g, '')
      .replace(/,(?=\d{3}(\D|$))/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? Math.abs(numero) : null;
  }

  function fechaISO(valor) {
    if (!valor) return '';
    const limpio = limpiar(valor).toLowerCase();
    const meses = {
      enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
      julio: 7, agosto: 8, septiembre: 9, setiembre: 9,
      octubre: 10, noviembre: 11, diciembre: 12
    };

    let m = limpio.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (m) {
      let anio = Number(m[3]);
      if (anio < 100) anio += 2000;
      return `${anio}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
    }

    m = limpio.match(/(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(\d{4})/);
    if (m && meses[m[2]]) {
      return `${m[3]}-${String(meses[m[2]]).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
    }

    return '';
  }

  function extraer(textoBase, patrones, transformador = valor => valor) {
    for (const patron of patrones) {
      const coincidencia = textoBase.match(patron);
      if (coincidencia?.[1] !== undefined) return transformador(coincidencia[1]);
    }
    return null;
  }

  function extraerMonto(textoBase, etiquetas) {
    const patrones = etiquetas.flatMap(etiqueta => [
      new RegExp(`${etiqueta}[^0-9]{0,30}(?:S\\/?\\.?|PEN|US\\$|USD|\\$)?\\s*([0-9][0-9.,]*)`, 'i'),
      new RegExp(`(?:S\\/?\\.?|PEN|US\\$|USD|\\$)\\s*([0-9][0-9.,]*)[^a-z0-9]{0,20}${etiqueta}`, 'i')
    ]);
    return extraer(textoBase, patrones, numeroMonetario);
  }

  function extraerFecha(textoBase, etiquetas) {
    const patrones = etiquetas.map(etiqueta => new RegExp(
      `${etiqueta}[^0-9a-z]{0,20}([0-9]{1,2}[\\/-][0-9]{1,2}[\\/-][0-9]{2,4}|[0-9]{1,2}\\s+de\\s+[a-z]+\\s+(?:de\\s+)?[0-9]{4})`,
      'i'
    ));
    return extraer(textoBase, patrones, fechaISO) || '';
  }

  function extraerUltimos4(textoBase) {
    return extraer(textoBase, [
      /(?:terminada|termina|finaliza|tarjeta|card|ultimos?\s+(?:4|cuatro)\s+digitos)[^0-9]{0,20}(?:x{2,}|\*{2,}|•{2,})?\s*(\d{4})/i,
      /(?:x{4,}|\*{4,}|•{4,})\s*(\d{4})/i
    ], valor => valor) || '';
  }

  function detectarMoneda(textoBase) {
    if (/US\$|USD|dolares?/i.test(textoBase)) return 'USD';
    return 'PEN';
  }

  function detectarTipoGenerico(textoBase) {
    if (/estado\s+de\s+cuenta|pago\s+minimo|fecha\s+de\s+vencimiento|total\s+a\s+pagar/i.test(textoBase)) return 'estado-cuenta';
    if (/pago\s+(?:de|a)\s+(?:tu\s+)?tarjeta|abono\s+a\s+tarjeta|pago\s+recibido/i.test(textoBase)) return 'pago-tarjeta';
    if (/compra|consumo|operacion|transaccion/i.test(textoBase)) return 'consumo-credito';
    if (/yape|yapeaste|te\s+yapearon/i.test(textoBase)) return 'yape';
    if (/deposito|abono|transferencia\s+recibida/i.test(textoBase)) return 'deposito';
    return 'otro';
  }

  const REGLAS = [
    {
      id: 'santander-pe',
      banco: 'Santander',
      detectar: t => /santander/i.test(t),
      remitentes: ['santander', 'bancosantander'],
      extraer(correo, t) {
        return construirResultado('Santander', correo, t, {
          pagoTotal: extraerMonto(t, ['pago total', 'total a pagar', 'monto total']),
          pagoMinimo: extraerMonto(t, ['pago minimo', 'minimo a pagar']),
          fechaCierre: extraerFecha(t, ['fecha de cierre', 'cierre']),
          fechaVencimiento: extraerFecha(t, ['fecha de vencimiento', 'vence', 'vencimiento']),
          lineaTotal: extraerMonto(t, ['linea total', 'linea de credito', 'limite de credito']),
          lineaDisponible: extraerMonto(t, ['linea disponible', 'credito disponible'])
        });
      }
    },
    {
      id: 'bbva-pe',
      banco: 'BBVA',
      detectar: t => /\bbbva\b|banco continental/i.test(t),
      remitentes: ['bbva', 'bbvacontinental'],
      extraer(correo, t) {
        return construirResultado('BBVA', correo, t, {
          pagoTotal: extraerMonto(t, ['pago del mes', 'pago total', 'deuda total', 'monto facturado']),
          pagoMinimo: extraerMonto(t, ['pago minimo', 'cuota minima']),
          fechaCierre: extraerFecha(t, ['fecha de facturacion', 'fecha de cierre', 'cierre de ciclo']),
          fechaVencimiento: extraerFecha(t, ['fecha limite de pago', 'fecha de vencimiento', 'vence']),
          lineaTotal: extraerMonto(t, ['linea de credito', 'limite de credito']),
          lineaDisponible: extraerMonto(t, ['linea disponible', 'disponible para compras'])
        });
      }
    },
    {
      id: 'bcp-pe',
      banco: 'BCP',
      detectar: t => /\bbcp\b|banco de credito del peru/i.test(t),
      remitentes: ['bcp', 'viabcp'],
      extraer(correo, t) {
        return construirResultado('BCP', correo, t, {
          pagoTotal: extraerMonto(t, ['pago total del mes', 'pago total', 'deuda facturada']),
          pagoMinimo: extraerMonto(t, ['pago minimo del mes', 'pago minimo']),
          fechaCierre: extraerFecha(t, ['fecha de cierre', 'cierre de facturacion']),
          fechaVencimiento: extraerFecha(t, ['fecha de pago', 'fecha de vencimiento', 'vence']),
          lineaTotal: extraerMonto(t, ['linea de credito', 'limite']),
          lineaDisponible: extraerMonto(t, ['linea disponible', 'saldo disponible'])
        });
      }
    },
    {
      id: 'falabella-pe',
      banco: 'Banco Falabella',
      detectar: t => /falabella|cmr/i.test(t),
      remitentes: ['falabella', 'cmr'],
      extraer(correo, t) {
        return construirResultado('Banco Falabella', correo, t, {
          pagoTotal: extraerMonto(t, ['pago total', 'total facturado', 'monto total a pagar']),
          pagoMinimo: extraerMonto(t, ['pago minimo', 'monto minimo']),
          fechaCierre: extraerFecha(t, ['fecha de facturacion', 'fecha de cierre']),
          fechaVencimiento: extraerFecha(t, ['fecha de vencimiento', 'fecha limite de pago']),
          lineaTotal: extraerMonto(t, ['cupo total', 'linea total', 'linea de credito']),
          lineaDisponible: extraerMonto(t, ['cupo disponible', 'linea disponible'])
        });
      }
    },
    {
      id: 'ripley-pe',
      banco: 'Banco Ripley',
      detectar: t => /ripley/i.test(t),
      remitentes: ['ripley', 'bancoripley'],
      extraer(correo, t) {
        return construirResultado('Banco Ripley', correo, t, {
          pagoTotal: extraerMonto(t, ['pago total', 'total a pagar', 'deuda del periodo']),
          pagoMinimo: extraerMonto(t, ['pago minimo', 'minimo a pagar']),
          fechaCierre: extraerFecha(t, ['fecha de cierre', 'periodo de facturacion']),
          fechaVencimiento: extraerFecha(t, ['fecha de vencimiento', 'fecha limite']),
          lineaTotal: extraerMonto(t, ['linea de credito', 'cupo total']),
          lineaDisponible: extraerMonto(t, ['linea disponible', 'cupo disponible'])
        });
      }
    }
  ];

  function construirResultado(banco, correo, textoBase, campos = {}) {
    const tipo = detectarTipoGenerico(textoBase);
    const montoOperacion = extraerMonto(textoBase, ['monto', 'importe', 'consumo', 'compra por', 'operacion por']);
    const fechaOperacion = extraerFecha(textoBase, ['fecha de operacion', 'fecha', 'realizada el', 'operacion realizada el']);
    const comercio = extraer(textoBase, [
      /(?:establecimiento|comercio|en)\s*[:\-]?\s*([a-z0-9 .,&'\/-]{3,80}?)(?:\s+(?:por|monto|importe|fecha|tarjeta)|[.,;]|$)/i,
      /compra\s+(?:realizada\s+)?en\s+([a-z0-9 .,&'\/-]{3,80}?)(?:\s+por|[.,;]|$)/i
    ], limpiar) || '';

    const resultado = {
      banco,
      tipo,
      monto: tipo === 'estado-cuenta' ? (campos.pagoTotal ?? montoOperacion) : montoOperacion,
      moneda: detectarMoneda(textoBase),
      fechaOperacion,
      ultimosDigitos: extraerUltimos4(textoBase),
      comercio,
      descripcion: limpiar(correo.asunto || correo.subject || `${banco} · movimiento detectado`),
      pagoTotal: campos.pagoTotal ?? null,
      pagoMinimo: campos.pagoMinimo ?? null,
      fechaCierre: campos.fechaCierre || '',
      fechaVencimiento: campos.fechaVencimiento || '',
      lineaTotal: campos.lineaTotal ?? null,
      lineaDisponible: campos.lineaDisponible ?? null,
      periodo: extraer(textoBase, [
        /periodo(?:\s+de\s+facturacion)?\s*[:\-]?\s*([a-z0-9\/\- ]{4,35})/i
      ], limpiar) || '',
      origen: 'outlook',
      messageId: correo.messageId || correo.id || null,
      remitente: correo.remitente || correo.from || '',
      asunto: correo.asunto || correo.subject || ''
    };

    resultado.camposDetectados = Object.entries(resultado)
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
      .map(([campo]) => campo);
    resultado.confianza = calcularConfianza(resultado);
    resultado.requiereRevision = resultado.confianza < 70 || !resultado.tipo || resultado.tipo === 'otro';
    return resultado;
  }

  function calcularConfianza(resultado) {
    let puntos = 20;
    if (resultado.banco) puntos += 20;
    if (resultado.tipo && resultado.tipo !== 'otro') puntos += 15;
    if (resultado.ultimosDigitos) puntos += 10;
    if (resultado.fechaOperacion || resultado.fechaCierre) puntos += 10;
    if (resultado.monto !== null || resultado.pagoTotal !== null) puntos += 15;
    if (resultado.tipo === 'estado-cuenta' && resultado.pagoMinimo !== null) puntos += 5;
    if (resultado.tipo === 'estado-cuenta' && resultado.fechaVencimiento) puntos += 5;
    return Math.min(100, puntos);
  }

  function detectarBanco(correo = {}) {
    const t = texto(correo);
    const regla = REGLAS.find(item => item.detectar(t));
    return regla ? { id: regla.id, banco: regla.banco, confianza: 100 } : null;
  }

  function interpretarCorreo(correo = {}) {
    const t = texto(correo);
    const regla = REGLAS.find(item => item.detectar(t));
    if (!regla) {
      const generico = construirResultado('', correo, t, {});
      generico.confianza = Math.min(generico.confianza, 45);
      generico.requiereRevision = true;
      generico.reglaId = 'generica';
      return generico;
    }
    return { ...regla.extraer(correo, t), reglaId: regla.id };
  }

  function interpretarLote(correos = []) {
    return correos.map(correo => ({ correo, resultado: interpretarCorreo(correo) }));
  }

  function registrarRegla(regla) {
    if (!regla?.id || typeof regla.detectar !== 'function' || typeof regla.extraer !== 'function') {
      throw new Error('La regla bancaria no es válida.');
    }
    if (REGLAS.some(item => item.id === regla.id)) throw new Error(`Ya existe la regla ${regla.id}.`);
    REGLAS.push(regla);
  }

  window.HFReglasBancarias = Object.freeze({
    detectarBanco,
    interpretarCorreo,
    interpretarLote,
    registrarRegla,
    numeroMonetario,
    fechaISO,
    bancosSoportados: () => REGLAS.map(({ id, banco }) => ({ id, banco }))
  });
})();
