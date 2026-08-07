/* Hogar Finanzas — diagnóstico Etapa 18 */
(() => {
  'use strict';
  const VERSION = '35.0-beta.4';
  if (window.HFDiagnosticoEtapa18?.version === VERSION) return;

  async function ejecutar() {
    const engine = window.HFEtapa18Beta4;
    if (!engine || !window.DB) throw new Error('La Etapa 18 beta 4 todavía no está lista.');
    await engine.refreshDebtStates?.();
    const [cards, loans, movements, goals] = await Promise.all([
      DB.getTarjetas(),
      DB.getPrestamos(),
      DB.getGastos(null),
      DB.getMetas()
    ]);
    const cardStates = cards.map(card => engine.deriveCardState(card, movements));
    const loanStates = loans.map(loan => window.HFEstadosPagadosAhorroReal35?.deriveLoanPaymentState?.(loan, movements) || {});
    const context = await engine.refreshAvailable?.();
    const month = context?.month || DB.getMesActual?.() || new Date().toISOString().slice(0, 7);
    const report = {
      version:VERSION,
      month,
      cards:cardStates,
      loans:loanStates,
      goals:goals.map(goal => ({
        id:goal.id,
        nombre:goal.nombre,
        objetivo:Number(goal.objetivo || 0),
        reservado:Number(goal.actual || 0),
        apartadoMes:Number(goal.reservadoMeses?.[month] || 0)
      })),
      available:context?.available ?? null,
      runtime:engine.getState?.() || null,
      domCards:[...document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card')].map(node => ({
        id:node.dataset.debtId,
        type:node.dataset.debtType,
        label:node.querySelector('.hf-v24-status')?.textContent?.trim() || ''
      }))
    };
    console.group('Hogar Finanzas · Diagnóstico Etapa 18 beta 4');
    console.table(cardStates.map(item => ({ tarjeta:item.name, estado:item.label || 'Pendiente', pagado:item.paid, pagoTotal:item.totalTarget, minimo:item.minimumTarget, uso:`${Math.round(item.usage || 0)}%`, vencimiento:item.statementDue || '' })));
    console.table(report.goals.map(item => ({ meta:item.nombre, reservado:item.reservado, apartadoMes:item.apartadoMes })));
    console.table(report.domCards);
    console.log(report);
    console.groupEnd();
    return report;
  }

  window.HFDiagnosticoEtapa18 = Object.freeze({ ejecutar, version:VERSION });
})();