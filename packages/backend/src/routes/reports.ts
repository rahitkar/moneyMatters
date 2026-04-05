import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cashFlowService } from '../services/cash-flow.service.js';
import { transactionService } from '../services/transaction.service.js';

const periodSchema = z.enum(['monthly', 'quarterly', 'yearly']);

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { period: string; start: string; end?: string } }>(
    '/',
    async (request, reply) => {
      const period = periodSchema.safeParse(request.query.period);
      if (!period.success) return reply.status(400).send({ error: 'Invalid period. Use monthly, quarterly, or yearly.' });

      const start = request.query.start;
      const end = request.query.end;

      if (period.data === 'monthly') {
        if (!/^\d{4}-\d{2}$/.test(start)) return reply.status(400).send({ error: 'start must be YYYY-MM for monthly' });
        const summary = await cashFlowService.getMonthSummary(start);
        const positions = await transactionService.getAllPositions();
        const totalPortfolio = positions.reduce((s, p) => s + p.currentValue, 0);
        const totalCost = positions.reduce((s, p) => s + p.totalCost, 0);

        return {
          period: 'monthly',
          month: start,
          cashFlow: summary,
          portfolio: { totalValue: totalPortfolio, totalCost, unrealizedGain: totalPortfolio - totalCost, positionCount: positions.length },
        };
      }

      if (period.data === 'quarterly') {
        if (!/^\d{4}-Q[1-4]$/.test(start)) return reply.status(400).send({ error: 'start must be YYYY-Q1..Q4' });
        const [yearStr, qStr] = start.split('-Q');
        const quarter = parseInt(qStr);
        const year = parseInt(yearStr);

        // FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
        const qMonths: string[] = [];
        if (quarter === 1) {
          qMonths.push(`${year}-04`, `${year}-05`, `${year}-06`);
        } else if (quarter === 2) {
          qMonths.push(`${year}-07`, `${year}-08`, `${year}-09`);
        } else if (quarter === 3) {
          qMonths.push(`${year}-10`, `${year}-11`, `${year}-12`);
        } else {
          qMonths.push(`${year + 1}-01`, `${year + 1}-02`, `${year + 1}-03`);
        }

        const monthSummaries = await Promise.all(qMonths.map((m) => cashFlowService.getMonthSummary(m)));

        const totalIncome = monthSummaries.reduce((s, m) => s + m.totals.totalIncome, 0);
        const totalExpenses = monthSummaries.reduce((s, m) => s + m.totals.totalExpenses, 0);
        const totalInvested = monthSummaries.reduce((s, m) => s + m.totals.totalInvested, 0);
        const totalSavings = monthSummaries.reduce((s, m) => s + m.totals.savings, 0);

        return {
          period: 'quarterly',
          quarter: start,
          months: qMonths,
          aggregate: { totalIncome, totalExpenses, totalInvested, totalSavings },
          monthDetails: monthSummaries,
        };
      }

      // yearly — FY Apr to Mar
      if (!/^\d{4}$/.test(start)) return reply.status(400).send({ error: 'start must be YYYY for yearly' });
      const yearly = await cashFlowService.getYearlySummary(start);
      const positions = await transactionService.getAllPositions();
      const totalPortfolio = positions.reduce((s, p) => s + p.currentValue, 0);
      const totalCost = positions.reduce((s, p) => s + p.totalCost, 0);

      const totalIncome = yearly.months.reduce((s, m) => s + m.totals.totalIncome, 0);
      const totalExpenses = yearly.months.reduce((s, m) => s + m.totals.totalExpenses, 0);
      const totalInvested = yearly.months.reduce((s, m) => s + m.totals.totalInvested, 0);
      const totalSavings = yearly.months.reduce((s, m) => s + m.totals.savings, 0);

      return {
        period: 'yearly',
        fy: `FY ${start}-${parseInt(start) + 1}`,
        aggregate: { totalIncome, totalExpenses, totalInvested, totalSavings },
        portfolio: { totalValue: totalPortfolio, totalCost, unrealizedGain: totalPortfolio - totalCost },
        monthDetails: yearly.months,
      };
    },
  );
}
