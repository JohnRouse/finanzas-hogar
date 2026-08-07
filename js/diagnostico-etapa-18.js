/* Hogar Finanzas — diagnóstico Etapa 18 */
(() => {
  'use strict';
  const VERSION = '35.0-beta.6';
  if (window.HFDiagnosticoEtapa18?.version === VERSION) return;

  async function ejecutar() {
    const financeEngine = window.HFEtapa18Beta6;
    const cardEngine = window.HFEtapa18Beta5;
    if (!financeEngine || !cardEngine || !window.DB) throw new Error('La Etapa 18 beta 6 todavía no está lista.');

    await cardEngine.refreshDebtStates?.();
    const context = await financeEngine.financialContext?.();
    const [cards, movements, goals] = await Promise.all([
      DB.getTarjetas(),
      DB.getGastos(null),
      DB.getMetas()
    ]);

    const cardStates = cards.map(card => cardEngine.deriveCardState(card, movements));
    const month = context?.month || DB.getMesActual?.() || new Date().toISOString().slice(0,7);
    const goalRows = goals.map(goal => {
      const months = goal.reservadoMeses && typeof goal.reservadoMeses === 'object' ? goal.reservadoMeses : {};
      const tracked = Object.values(months).reduce((sum,value) => sum + Number(value || 0), 0);
      return {
        id:goal.id,
        nombre:goal.nombre,
        objetivo:Number(goal.objetivo || 0),
        reservado:Number(goal.actual || 0),
        apartadoMes:Number(months[month] || 0),
        tracked:Number(tracked.toFixed(2)),
        diferencia:Number((Number(goal.actual || 0)-tracked).toFixed(2)),
        porMes:JSON.stringify(months)
      };
    });

    const report = {
      version:VERSION,
      month,
      cards:cardStates,
      goals:goalRows,
      finance:context ? {
        ingresos:context.incomeTotal,
        salidasEfectivo:context.cashOut,
        disponibleAntesAhorro:context.availableBeforeSaving,
        apartadoMes:context.savedThisMonth,
        ahorroReservado:context.totalSaved,
        disponibleReal:context.available,
        formula:'disponibleAntesAhorro - ahorroReservado'
      } : null,
      domCards:[...document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card')].map(node => ({
        id:node.dataset.debtId,
        type:node.dataset.debtType,
        label:node.querySelector('.hf-v24-status')?.textContent?.trim() || ''
      })),
      runtime:{
        beta5:cardEngine.getState?.() || null,
        beta6:financeEngine.getState?.() || null
      }
    };

    console.group('Hogar Finanzas · Diagnóstico Etapa 18 beta 6');
    console.table(cardStates.map(item => ({ tarjeta:item.name, estado:item.label || 'Pendiente', pagado:item.paid, pagoTotal:item.totalTarget, minimo:item.minimumTarget, uso:`${Math.round(item.usage || 0)}%`, vencimiento:item.statementDue || '' })));
    console.table(goalRows.map(item => ({ meta:item.nombre, reservado:item.reservado, apartadoMes:item.apartadoMes, tracked:item.tracked, diferencia:item.diferencia, porMes:item.porMes })));
    console.table(report.domCards);
    console.log(report.finance);
    console.log(report);
    console.groupEnd();
    return report;
  }

  window.HFDiagnosticoEtapa18 = Object.freeze({ ejecutar, version:VERSION });
})();