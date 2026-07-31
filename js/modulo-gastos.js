/* Hogar Finanzas — Etapa 14.2: módulo de dominio para gastos */
(() => {
  'use strict';

  if (window.HFModuloGastos) return;

  const ESTADO = {
    instalado: false,
    funcionesDecoradas: new Set(),
    ultimaOperacion: null
  };

  const obtener = id => document.getElementById(id);
  const numero = valor => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  };

  function registrarError(origen, error, contexto = {}) {
    if (window.HFEstabilidadApp?.registrarError) {
      window.HFEstabilidadApp.registrarError(`modulo-gastos:${origen}`, error, contexto);
    } else {
      console.warn(`[modulo-gastos:${origen}]`, error, contexto);
    }
  }

  function leerFormularioDetallado() {
    const categoria = document.querySelector('#cat-chips .chip.selected')?.textContent?.trim() || '';
    return {
      tipo: 'detallado',
      descripcion: obtener('g-desc')?.value?.trim() || '',
      monto: numero(obtener('g-monto')?.value),
      quien: obtener('g-quien')?.value || 'yo',
      categoria,
      fecha: obtener('g-fecha')?.value || '',
      medio: obtener('g-medio')?.value || 'efectivo',
      tarjetaId: obtener('g-tarjeta-id')?.value || null,
      recurrente: Boolean(obtener('checkRecurrente')?.checked)
    };
  }

  function leerFormularioRapido() {
    return {
      tipo: 'rapido',
      descripcion: '',
      monto: numero(obtener('gr-monto')?.value),
      quien: obtener('gr-quien')?.value || 'yo',
      categoria: obtener('gr-cat')?.value || '',
      fecha: new Date().toISOString().slice(0, 10),
      medio: obtener('gr-medio')?.value || 'efectivo',
      tarjetaId: obtener('gr-tarjeta')?.value || null,
      recurrente: false
    };
  }

  function validar(gasto = {}) {
    const errores = [];
    if (!(numero(gasto.monto) > 0)) errores.push('El monto debe ser mayor que cero.');
    if (!gasto.categoria) errores.push('Selecciona una categoría.');
    if (!gasto.quien) errores.push('Selecciona quién realizó el gasto.');
    if (!gasto.fecha) errores.push('Selecciona una fecha.');
    if (gasto.medio === 'tarjeta' && !gasto.tarjetaId) errores.push('Selecciona la tarjeta utilizada.');
    return { valido: errores.length === 0, errores };
  }

  function publicar(nombre, detalle = {}) {
    const payload = { fecha: new Date().toISOString(), ...detalle };
    window.dispatchEvent(new CustomEvent(nombre, { detail: payload }));
    return payload;
  }

  function prepararOperacion(tipo) {
    const gasto = tipo === 'rapido' ? leerFormularioRapido() : leerFormularioDetallado();
    const validacion = validar(gasto);
    const operacion = { tipo, gasto, validacion, inicio: new Date().toISOString() };
    ESTADO.ultimaOperacion = operacion;
    publicar('hf:gasto-operacion-iniciada', operacion);
    return operacion;
  }

  function finalizarOperacion(operacion, resultado, error = null) {
    const detalle = {
      ...operacion,
      fin: new Date().toISOString(),
      resultado: resultado ?? null,
      error: error ? { nombre: error.name, mensaje: error.message } : null
    };
    ESTADO.ultimaOperacion = detalle;
    publicar(error ? 'hf:gasto-operacion-fallida' : 'hf:gasto-operacion-completada', detalle);
    if (!error) {
      publicar('hf:gastos-actualizados', {
        origen: operacion.tipo,
        gasto: operacion.gasto,
        gastos: Array.isArray(window.gastosDelMesCache) ? window.gastosDelMesCache : null
      });
      window.HFHistorialGastos?.actualizar?.();
      window.HFIntegracionFinancieraTotal?.programar?.('gasto-registrado', operacion.gasto, true);
    }
    return resultado;
  }

  function decorarFuncion(nombre, tipo) {
    if (ESTADO.funcionesDecoradas.has(nombre)) return true;
    const original = window[nombre];
    if (typeof original !== 'function') return false;

    window[nombre] = async function funcionGastoDecorada(...args) {
      const operacion = prepararOperacion(tipo);
      if (!operacion.validacion.valido) {
        const mensaje = operacion.validacion.errores[0];
        if (typeof window.showToast === 'function') window.showToast(mensaje);
        publicar('hf:gasto-validacion-fallida', operacion);
        return false;
      }

      try {
        const resultado = await original.apply(this, args);
        return finalizarOperacion(operacion, resultado);
      } catch (error) {
        registrarError(nombre, error, { gasto: operacion.gasto });
        finalizarOperacion(operacion, null, error);
        throw error;
      }
    };

    ESTADO.funcionesDecoradas.add(nombre);
    return true;
  }

  function instalarDecoradores() {
    const resultados = {
      agregarGasto: decorarFuncion('agregarGasto', 'detallado'),
      agregarGastoRapido: decorarFuncion('agregarGastoRapido', 'rapido')
    };
    ESTADO.instalado = Object.values(resultados).some(Boolean);
    publicar('hf:modulo-gastos-listo', { resultados });
    return resultados;
  }

  function observarFunciones() {
    let intentos = 0;
    const intervalo = setInterval(() => {
      intentos += 1;
      const resultados = instalarDecoradores();
      if ((resultados.agregarGasto && resultados.agregarGastoRapido) || intentos >= 20) {
        clearInterval(intervalo);
      }
    }, 250);
  }

  observarFunciones();

  window.HFModuloGastos = Object.freeze({
    leerFormularioDetallado,
    leerFormularioRapido,
    validar,
    prepararOperacion,
    instalarDecoradores,
    obtenerEstado: () => ({
      instalado: ESTADO.instalado,
      funcionesDecoradas: [...ESTADO.funcionesDecoradas],
      ultimaOperacion: ESTADO.ultimaOperacion
    })
  });
})();