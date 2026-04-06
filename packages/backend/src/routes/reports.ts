import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cashFlowService } from '../services/cash-flow.service.js';
import { portfolioService, getDayChanges } from '../services/portfolio.service.js';
import { performanceService } from '../services/performance.service.js';
import type { TimeInterval } from '../db/schema.js';

const periodSchema = z.enum(['monthly', 'quarterly', 'yearly']);

async function getPortfolioBlock() {
  const [summary, allocation, topPerformers, worstPerformers] = await Promise.all([
    portfolioService.getSummary(),
    portfolioService.getAllocation(),
    portfolioService.getTopPerformers(5),
    portfolioService.getWorstPerformers(5),
  ]);
  return { summary, allocation, topPerformers, worstPerformers };
}

async function getDayChangeBlock() {
  try {
    const result = await getDayChanges();
    return {
      change: result.totalDayChange,
      changePercent: result.totalDayChangePercent,
    };
  } catch {
    return null;
  }
}

async function getPerformanceIntervals() {
  const intervals: TimeInterval[] = ['5D', '1M', '3M', '6M', '1Y', 'YTD', 'ALL'];
  const results: Record<string, { absoluteReturn: number; percentageReturn: number; annualizedReturn: number | null }> = {};
  await Promise.all(
    intervals.map(async (interval) => {
      try {
        const p = await performanceService.getPortfolioPerformance(interval);
        results[interval] = {
          absoluteReturn: p.absoluteReturn,
          percentageReturn: p.percentageReturn,
          annualizedReturn: p.annualizedReturn,
        };
      } catch { /* skip */ }
    }),
  );
  return results;
}

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { period: string; start: string; end?: string } }>(
    '/',
    async (request, reply) => {
      const period = periodSchema.safeParse(request.query.period);
      if (!period.success) return reply.status(400).send({ error: 'Invalid period. Use monthly, quarterly, or yearly.' });

      const start = request.query.start;

      const [portfolioBlock, dayChange, perfIntervals] = await Promise.all([
        getPortfolioBlock(),
        getDayChangeBlock(),
        getPerformanceIntervals(),
      ]);

      const commonPortfolio = {
        portfolio: portfolioBlock.summary,
        allocation: portfolioBlock.allocation,
        topPerformers: portfolioBlock.topPerformers,
        worstPerformers: portfolioBlock.worstPerformers,
        dayChange,
        performanceIntervals: perfIntervals,
      };

      if (period.data === 'monthly') {
        if (!/^\d{4}-\d{2}$/.test(start)) return reply.status(400).send({ error: 'start must be YYYY-MM for monthly' });
        const summary = await cashFlowService.getMonthSummary(start);

        return {
          period: 'monthly',
          month: start,
          cashFlow: summary,
          ...commonPortfolio,
        };
      }

      if (period.data === 'quarterly') {
        if (!/^\d{4}-Q[1-4]$/.test(start)) return reply.status(400).send({ error: 'start must be YYYY-Q1..Q4' });
        const [yearStr, qStr] = start.split('-Q');
        const quarter = parseInt(qStr);
        const year = parseInt(yearStr);

        const qMonths: string[] = [];
        if (quarter === 1) qMonths.push(`${year}-04`, `${year}-05`, `${year}-06`);
        else if (quarter === 2) qMonths.push(`${year}-07`, `${year}-08`, `${year}-09`);
        else if (quarter === 3) qMonths.push(`${year}-10`, `${year}-11`, `${year}-12`);
        else qMonths.push(`${year + 1}-01`, `${year + 1}-02`, `${year + 1}-03`);

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
          ...commonPortfolio,
        };
      }

      // yearly — FY Apr to Mar
      if (!/^\d{4}$/.test(start)) return reply.status(400).send({ error: 'start must be YYYY for yearly' });
      const yearly = await cashFlowService.getYearlySummary(start);
      const totalIncome = yearly.months.reduce((s, m) => s + m.totals.totalIncome, 0);
      const totalExpenses = yearly.months.reduce((s, m) => s + m.totals.totalExpenses, 0);
      const totalInvested = yearly.months.reduce((s, m) => s + m.totals.totalInvested, 0);
      const totalSavings = yearly.months.reduce((s, m) => s + m.totals.savings, 0);

      return {
        period: 'yearly',
        fy: `FY ${start}-${parseInt(start) + 1}`,
        aggregate: { totalIncome, totalExpenses, totalInvested, totalSavings },
        monthDetails: yearly.months,
        ...commonPortfolio,
      };
    },
  );
}
