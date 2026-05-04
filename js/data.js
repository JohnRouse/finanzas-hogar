/* ══════════════════════════════════════════
   HOGAR FINANZAS — data.js (VERSIÓN FINAL LIMPIA)
   Firebase Compat - Tarjetas, Préstamos y Metas
   ══════════════════════════════════════════ */

// Intentar cargar el hogarId desde el almacenamiento local al iniciar
let hogarId = localStorage.getItem('hogarId'); 

const DB = {
  async init() {
    if (!hogarId) {
      console.log("ℹ️ No hay hogarId local. El usuario debe configurar uno nuevo o unirse.");
      return;
    }
    const cfg = await this.getConfig();
    if (cfg) {
      console.log("✅ Hogar cargado desde Firebase:", hogarId);
    }
  },

  async getConfig() {
    if (!hogarId) return null;
    try {
      const docRef = db.collection("hogares").doc(hogarId).collection("data").doc("config");
      const doc = await docRef.get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      console.error("Error getConfig:", e);
      return null;
    }
  },

  async saveConfig(cfg) {
    // Si no existe un ID, generamos uno nuevo (Primera vez del primer usuario)
    if (!hogarId) {
      hogarId = "HOGAR-" + Math.random().toString(36).substring(2,10).toUpperCase();
      localStorage.setItem('hogarId', hogarId);
    }
    cfg.hogarId = hogarId;
    
    try {
      const docRef = db.collection("hogares").doc(hogarId).collection("data").doc("config");
      await docRef.set(cfg);
      console.log("✅ Configuración guardada en Firebase");
      return cfg;
    } catch (e) {
      console.error("Error saveConfig:", e);
      return null;
    }
  },

  // NUEVA FUNCIÓN: Para que el segundo dispositivo se una al hogar
  async joinHogar(id) {
    if (!id || !id.startsWith("HOGAR-")) {
      alert("Código de hogar no válido");
      return false;
    }
    localStorage.setItem('hogarId', id);
    hogarId = id;
    // Verificamos si ese hogar existe en Firebase
    const cfg = await this.getConfig();
    if (cfg) {
      location.reload(); // Recargamos para que toda la app use el nuevo ID
      return true;
    } else {
      alert("No se encontró ningún hogar con ese código.");
      localStorage.removeItem('hogarId');
      return false;
    }
  },

  /* ── GASTOS ── */
  async getGastos(mes = null) {
  if (!hogarId) return [];
  try {
    const snapshot = await db.collection("hogares").doc(hogarId).collection("gastos").get();
    let gastos = [];
    snapshot.forEach(function(doc) {
      gastos.push({ id: doc.id, ...doc.data() });
    });
    if (mes) {
      gastos = gastos.filter(function(g) { return g.mes === mes; });
    }
    return gastos.sort(function(a,b) {
      return (b.fecha || '').localeCompare(a.fecha || '');
    });
  } catch (e) {
    console.error("Error getGastos:", e);
    return [];
  }
},

  async addGasto(gasto) {
    if (!hogarId) return null;
    gasto.mes = gasto.fecha.slice(0,7);
    try {
      const docRef = await db.collection("hogares").doc(hogarId).collection("gastos").add(gasto);
      gasto.id = docRef.id;
      console.log("✅ Gasto agregado");
      return gasto;
    } catch (e) {
      console.error("Error addGasto:", e);
      return null;
    }
  },

  async deleteGasto(id) {
    if (!hogarId) return;
    try {
      await db.collection("hogares").doc(hogarId).collection("gastos").doc(id).delete();
    } catch (e) {
      console.error("Error deleteGasto:", e);
    }
  },

  /* ── TARJETAS ── */
  async getTarjetas() {
    if (!hogarId) return [];
    try {
      const snapshot = await db.collection("hogares").doc(hogarId).collection("tarjetas").get();
      let list = [];
      snapshot.forEach(function(doc) {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (e) {
      console.error("Error getTarjetas:", e);
      return [];
    }
  },

  async addTarjeta(t) {
    if (!hogarId) return;
    try {
      await db.collection("hogares").doc(hogarId).collection("tarjetas").add(t);
      console.log("✅ Tarjeta guardada en Firebase");
    } catch (e) {
      console.error("Error addTarjeta:", e);
    }
  },

  async deleteTarjeta(id) {
    if (!hogarId) return;
    try {
      await db.collection("hogares").doc(hogarId).collection("tarjetas").doc(id).delete();
    } catch (e) {
      console.error("Error deleteTarjeta:", e);
    }
  },

  /* ── PRÉSTAMOS ── */
  async getPrestamos() {
    if (!hogarId) return [];
    try {
      const snapshot = await db.collection("hogares").doc(hogarId).collection("prestamos").get();
      let list = [];
      snapshot.forEach(function(doc) {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (e) {
      console.error("Error getPrestamos:", e);
      return [];
    }
  },

  async addPrestamo(p) {
    if (!hogarId) return;
    try {
      await db.collection("hogares").doc(hogarId).collection("prestamos").add(p);
      console.log("✅ Préstamo guardado en Firebase");
    } catch (e) {
      console.error("Error addPrestamo:", e);
    }
  },

  async deletePrestamo(id) {
    if (!hogarId) return;
    try {
      await db.collection("hogares").doc(hogarId).collection("prestamos").doc(id).delete();
    } catch (e) {
      console.error("Error deletePrestamo:", e);
    }
  },

  /* ── METAS ── */
  async getMetas() {
    if (!hogarId) return [];
    try {
      const snapshot = await db.collection("hogares").doc(hogarId).collection("metas").get();
      let list = [];
      snapshot.forEach(function(doc) {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (e) {
      console.error("Error getMetas:", e);
      return [];
    }
  },

  async addMeta(m) {
    if (!hogarId) return;
    try {
      await db.collection("hogares").doc(hogarId).collection("metas").add(m);
      console.log("✅ Meta guardada en Firebase");
    } catch (e) {
      console.error("Error addMeta:", e);
    }
  },

  async deleteMeta(id) {
    if (!hogarId) return;
    try {
      await db.collection("hogares").doc(hogarId).collection("metas").doc(id).delete();
    } catch (e) {
      console.error("Error deleteMeta:", e);
    }
  },

  /* UTILIDADES */
  resetAll() {
    localStorage.clear();
    hogarId = null;
  },

  getMesActual() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  },

  formatMes(mesStr) {
    const [y, m] = mesStr.split('-');
    const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${nombres[parseInt(m)-1]} ${y}`;
  },

  /* ── GESTIÓN DE RECURRENTES ── */
  /* ── RECURRENTES ── */
async getRecurrentes() {
  if (!hogarId) return [];
  try {
    const snapshot = await db.collection("hogares").doc(hogarId).collection("recurrentes").get();
    let list = [];
    snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    return list;
  } catch (e) {
    console.error("Error getRecurrentes:", e);
    return [];
  }
},

async addRecurrente(gastoBase) {
  if (!hogarId) return;
  // Extraer día del mes de la fecha
  const dia = new Date(gastoBase.fecha + 'T12:00:00').getDate();
  const recurrente = {
    desc: gastoBase.desc,
    monto: gastoBase.monto,
    quien: gastoBase.quien,
    cat: gastoBase.cat,
    icono: gastoBase.icono,
    medio: gastoBase.medio || 'efectivo',
    tarjetaId: gastoBase.tarjetaId || null,
    tarjetaNombre: gastoBase.tarjetaNombre || null,
    dia: dia,
    activo: true,
    creadoEn: new Date().toISOString()
  };
  try {
    await db.collection("hogares").doc(hogarId).collection("recurrentes").add(recurrente);
    console.log("✅ Recurrente guardado");
  } catch (e) {
    console.error("Error addRecurrente:", e);
  }
},

async deleteRecurrente(id) {
  if (!hogarId) return;
  try {
    await db.collection("hogares").doc(hogarId).collection("recurrentes").doc(id).delete();
    console.log("Recurrente eliminado");
  } catch (e) {
    console.error("Error deleteRecurrente:", e);
  }
},

async marcarRecurrentesProcesados(mes) {
  if (!hogarId) return;
  await db.collection("hogares").doc(hogarId).collection("data").doc("estado").set({
    [`recurrentesProcesados_${mes}`]: true
  }, { merge: true });
},

async yaProcesadosRecurrentes(mes) {
  if (!hogarId) return false;
  const doc = await db.collection("hogares").doc(hogarId).collection("data").doc("estado").get();
  return doc.exists && doc.data()[`recurrentesProcesados_${mes}`] === true;
},

// Dentro del objeto DB en data.js
async enviarNotificacion(mensaje) {
  if (!hogarId) return;
  try {
    await db.collection("hogares").doc(hogarId).collection("notificaciones").add({
      texto: mensaje,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      usuarioId: auth.currentUser ? auth.currentUser.uid : 'anonimo'
    });
    console.log("📢 Notificación enviada a Firebase");
  } catch (e) {
    console.error("Error al enviar notificación:", e);
  }
},

/* ── INGRESOS EXTRAS ── */
async getIngresosExtras(mes = null) {
  if (!hogarId) return [];
  try {
    const snapshot = await db.collection("hogares").doc(hogarId).collection("ingresos").get();
    let list = [];
    snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    if (mes) {
      list = list.filter(i => i.fecha?.startsWith(mes));
    }
    return list;
  } catch (e) {
    console.error("Error getIngresosExtras:", e);
    return [];
  }
},


// Obtener todos los ingresos (extras y arrastres) del mes
async getIngresosMes(mes = null) {
  if (!hogarId) return [];
  try {
    const snapshot = await db.collection("hogares").doc(hogarId).collection("ingresos").get();
    let list = [];
    snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
    if (mes) {
      list = list.filter(i => i.fecha && i.fecha.startsWith(mes));
    }
    return list;
  } catch (e) {
    console.error("Error getIngresosMes:", e);
    return [];
  }
},

// Generar arrastre de remanente del mes anterior
async generarArrastreSiNecesario(mesActual) {
  if (!hogarId) return;
  
  const [year, month] = mesActual.split('-').map(Number);
  const mesAnteriorDate = new Date(year, month - 2, 1);
  const mesAnteriorStr = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, '0')}`;
  
  // ID fijo para evitar duplicados
  const docId = `arrastre_${mesAnteriorStr}`;
  const docRef = db.collection("hogares").doc(hogarId).collection("ingresos").doc(docId);
  
  // Verificar atómicamente si ya existe
  const docSnap = await docRef.get();
  if (docSnap.exists) {
  const arrastreExistente = docSnap.data();
  const montoGuardado = parseFloat(arrastreExistente.monto) || 0;
  
  // Si el ahorro real del mes anterior cambió, actualizamos el arrastre
  if (Math.abs(montoGuardado - ahorroAnterior) > 0.01) {
    await docRef.update({ monto: ahorroAnterior });
    console.log(`🔄 Arrastre actualizado: ${mesAnteriorStr} de ${montoGuardado} → ${ahorroAnterior}`);
  } else {
    console.log(`ℹ️ Arrastre de ${mesAnteriorStr} ya existe y está actualizado.`);
  }
  return;
}
  
  // Obtener datos reales del mes anterior
  const ingresosAnteriores = await this.getIngresosMes(mesAnteriorStr);
  const gastosAnteriores = await this.getGastos(mesAnteriorStr);
  
  const ingresoTotalAnterior = ingresosAnteriores.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
  const gastoTotalAnterior = gastosAnteriores.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  const gastosEfectivoAnterior = gastosAnteriores
  .filter(g => g.medio !== 'tarjeta')
  .reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);

  const ahorroAnterior = Math.max(0, ingresoTotalAnterior - gastosEfectivoAnterior);
  
  if (ahorroAnterior > 0) {
    try {
      // Intentar crear con ID fijo (falla si ya existe)
      await docRef.set({
        desc: `Remanente de ${this.formatMes(mesAnteriorStr)}`,
        monto: ahorroAnterior,
        quien: 'ambos',
        fecha: `${mesActual}-01`,
        tipo: 'arrastre',
        creadoEn: new Date().toISOString()
      }, { merge: false }); // merge: false = fail if exists
      console.log(`✅ Remanente generado: ${mesAnteriorStr} → ${ahorroAnterior}`);
    } catch (e) {
      // Si otro proceso ya lo creó, ignoramos silenciosamente
      console.warn(`⚠️ El arrastre de ${mesAnteriorStr} ya fue creado por otro proceso.`);
    }
  } else {
    console.log(`ℹ️ Sin remanente de ${mesAnteriorStr} para arrastrar.`);
  }
},

// Modificar addIngresoExtra para que llame a addIngreso genérico
async addIngreso(ingreso) {
  if (!hogarId) return null;
  try {
    await db.collection("hogares").doc(hogarId).collection("ingresos").add(ingreso);
    console.log("✅ Ingreso agregado");
  } catch (e) {
    console.error("Error addIngreso:", e);
  }
},

async addIngresoExtra(ingreso) {
  return this.addIngreso(ingreso);
},

async deleteIngresoExtra(id) {
  if (!hogarId) return;
  try {
    await db.collection("hogares").doc(hogarId).collection("ingresos").doc(id).delete();
  } catch (e) {
    console.error("Error deleteIngresoExtra:", e);
  }
}
};

Object.defineProperty(DB, 'hogarId', {
  get: () => hogarId
});

function solicitarPermisoNotificaciones() {
  const messaging = firebase.messaging();
  
  messaging.requestPermission()
    .then(() => messaging.getToken({ vapidKey: 'BJ2hOCo0ghqObiVlmWBrGd0QXux17QV8bzk6KxjT-1MwOhmPJHXCD3ArCbR_NeaSj2aFPr_jcQI7iyBdD_O_hl8' }))
    .then((token) => {
      // Este token identifica el celular. Debes guardarlo en Firestore 
      // dentro del documento del usuario en tu colección "hogares".
      DB.guardarTokenNotificacion(token);
    })
    .catch((err) => console.log('No se pudo obtener permiso:', err));
}



window.DB = DB;
DB.init();

console.log("✅ data.js cargado correctamente (Firebase Compat)");