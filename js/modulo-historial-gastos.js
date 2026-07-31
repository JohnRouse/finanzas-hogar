/* Hogar Finanzas — Etapa 14.1: módulo independiente de historial de gastos */
(() => {
  'use strict';

  if (window.HFHistorialGastos) return;

  const ESTADO = {
    gastos: [],
    consulta: '',
    instalado: false
  };

  const normalizar = valor => String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  function elemento(id) {
    return document.getElementById(id);
  }

  function registrarError(origen, error, contexto = {}) {
    if (window.HFEstabilidadApp?.registrarError) {
      window.HFEstabilidadApp.registrarError(`historial-gastos:${origen}`, error, contexto);
    } else {
      console.warn(`[historial-gastos:${origen}]`, error, contexto);
    }
  }

  function obtenerMesVisible() {
    const visible = elemento('month-display')?.textContent?.trim();
    if (visible) return visible;
    try {
      return window.DB?.formatMes?.(window.mesActual || null) || 'este mes';
    } catch (error) {
      registrarError('obtener-mes', error);
      return 'este mes';
    }
  }

  function obtenerGastos() {
    if (Array.isArray(window.gastosDelMesCache)) return window.gastosDelMesCache;
    try {
      if (typeof gastosDelMesCache !== 'undefined' && Array.isArray(gastosDelMesCache)) return gastosDelMesCache;
    } catch (_) {}
    return [];
  }

  function obtenerConfiguracion() {
    if (window.configCache && typeof window.configCache === 'object') return window.configCache;
    try {
      if (typeof configCache !== 'undefined' && configCache) return configCache;
    } catch (_) {}
    return {};
  }

  function obtenerGenerador() {
    if (typeof window.generarGastoHTML === 'function') return window.generarGastoHTML;
    try {
      if (typeof generarGastoHTML === 'function') return generarGastoHTML;
    } catch (_) {}
    return null;
  }

  function textoBusqueda(gasto = {}) {
    return normalizar([
      gasto.descripcion,
      gasto.nombre,
      gasto.categoria,
      gasto.quien,
      gasto.medio,
      gasto.nota,
      gasto.tarjetaNombre,
      gasto.banco
    ].filter(Boolean).join(' '));
  }

  function filtrarGastos(consulta = '') {
    const termino = normalizar(consulta);
    ESTADO.consulta = termino;
    if (!termino) return [...ESTADO.gastos];
    return ESTADO.gastos.filter(gasto => textoBusqueda(gasto).includes(termino));
  }

  function renderizar(gastos = ESTADO.gastos) {
    const lista = elemento('listaCompletaGastos');
    const sinResultados = elemento('historial-no-resultados');
    if (!lista) {
      registrarError('renderizar', new Error('No existe #listaCompletaGastos'));
      return false;
    }

    const generador = obtenerGenerador();
    const configuracion = obtenerConfiguracion();

    if (!gastos.length) {
      lista.innerHTML = ESTADO.consulta
        ? ''
        : '<div class="empty-state">No hay movimientos para mostrar.</div>';
      if (sinResultados) sinResultados.style.display = ESTADO.consulta ? 'block' : 'none';
      return true;
    }

    if (!generador) {
      lista.innerHTML = '<div class="empty-state">No se pudo preparar el historial.</div>';
      registrarError('renderizar', new Error('generarGastoHTML no está disponible'));
      return false;
    }

    lista.innerHTML = gastos.map(gasto => {
      try { return generador(gasto, configuracion) || ''; }
      catch (error) {
        registrarError('generar-item', error, { gastoId: gasto?.id || null });
        return '';
      }
    }).join('');

    if (sinResultados) sinResultados.style.display = 'none';
    return true;
  }

  function abrir() {
    try {
      ESTADO.gastos = [...obtenerGastos()];
      ESTADO.consulta = '';

      const titulo = elemento('historialTitle');
      if (titulo) titulo.textContent = `Movimientos de ${obtenerMesVisible()}`;

      const buscador = elemento('historial-search');
      const limpiar = elemento('historial-search-clear');
      const sinResultados = elemento('historial-no-resultados');
      if (buscador) buscador.value = '';
      if (limpiar) limpiar.style.display = 'none';
      if (sinResultados) sinResultados.style.display = 'none';

      renderizar(ESTADO.gastos);

      if (typeof window.openModal === 'function') window.openModal('modalHistorial');
      else elemento('modalHistorial')?.classList.add('active');

      requestAnimationFrame(() => setTimeout(() => {
        try {
          const inicializador = window.initGesturesModal || (typeof initGesturesModal === 'function' ? initGesturesModal : null);
          inicializador?.();
        } catch (error) {
          registrarError('gestos-modal', error);
        }
      }, 50));

      window.dispatchEvent(new CustomEvent('hf:historial-gastos-abierto', {
        detail: { cantidad: ESTADO.gastos.length, mes: obtenerMesVisible() }
      }));
      return true;
    } catch (error) {
      registrarError('abrir', error);
      if (typeof window.showToast === 'function') window.showToast('No se pudo abrir el historial de movimientos.');
      return false;
    }
  }

  function buscar(valor = '') {
    try {
      const limpiar = elemento('historial-search-clear');
      if (limpiar) limpiar.style.display = valor ? 'block' : 'none';
      const filtrados = filtrarGastos(valor);
      renderizar(filtrados);
      window.dispatchEvent(new CustomEvent('hf:historial-gastos-filtrado', {
        detail: { consulta: valor, resultados: filtrados.length }
      }));
      return filtrados;
    } catch (error) {
      registrarError('buscar', error, { valor });
      return [];
    }
  }

  function limpiarBusqueda() {
    const buscador = elemento('historial-search');
    if (buscador) {
      buscador.value = '';
      buscador.focus();
    }
    const limpiar = elemento('historial-search-clear');
    if (limpiar) limpiar.style.display = 'none';
    ESTADO.consulta = '';
    renderizar(ESTADO.gastos);
  }

  function actualizar(gastos = null) {
    ESTADO.gastos = Array.isArray(gastos) ? [...gastos] : [...obtenerGastos()];
    const filtrados = filtrarGastos(ESTADO.consulta);
    return renderizar(filtrados);
  }

  function instalarCompatibilidad() {
    window.abrirHistorialCompleto = abrir;
    window.filtrarHistorial = buscar;
    window.limpiarBusquedaHistorial = limpiarBusqueda;
    ESTADO.instalado = true;
    window.dispatchEvent(new CustomEvent('hf:modulo-historial-gastos-listo'));
  }

  instalarCompatibilidad();

  window.addEventListener('hf:gastos-actualizados', event => actualizar(event.detail?.gastos));
  window.addEventListener('hf:mes-cambiado', () => actualizar());

  window.HFHistorialGastos = Object.freeze({
    abrir,
    buscar,
    limpiarBusqueda,
    actualizar,
    renderizar,
    obtenerEstado: () => ({ ...ESTADO, gastos: [...ESTADO.gastos] })
  });
})();