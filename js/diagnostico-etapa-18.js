/* Hogar Finanzas — diagnóstico Etapa 18 */
(() => {
  'use strict';
  if (window.HFDiagnosticoEtapa18) return;

  async function ejecutar() {
    const engine = window.HFEstadosPagadosAhorroReal35;
    if (!engine || !window.DB) throw new Error('La Etapa 18 todavía no está lista.');
    const [cards, loans, movements, goals] = await Promise.all([
      DB.getTarjetas(),
      DB.getPrestamos(),
      DB.getGastos(null),
      DB.getMetas()
    ]);
    const cardStates = cards.map(card => engine.deriveCardPaymentState(card, movements));
    const loanStates = loans.map(loan => engine.deriveLoanPaymentState(loan, movements));
    const month = DB.getMesActual?.() || new Date().toISOString().slice(0, 7);
    const report = {
      version:engine.version,
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
      summary:engine.getState?.().correctedSummary || null,
      domCards:[...document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card')].map(node => ({
        id:node.dataset.debtId,
        type:node.dataset.debtType,
        label:node.querySelector('.hf-v24-status')?.textContent?.trim() || ''
      }))
    };
    console.group('Hogar Finanzas · Diagnóstico Etapa 18');
    console.table(cardStates.map(item => ({ tarjeta:item.name, estado:item.label || 'Pendiente', pagado:item.paid, pagoTotal:item.totalTarget, minimo:item.minimumTarget, uso:`${Math.round(item.usage)}%`, vencimiento:item.statementDue || '' })));
    console.table(report.goals.map(item => ({ meta:item.nombre, reservado:item.reservado, apartadoMes:item.apartadoMes })));
    console.log(report);
    console.groupEnd();
    return report;
  }

  window.HFDiagnosticoEtapa18 = Object.freeze({ ejecutar, version:'35.0-beta.1' });
})();