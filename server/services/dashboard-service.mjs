import { categories, monthOnly } from '../domain/finance-values.mjs';
import {
  effectiveIncomeEnd,
  effectiveRecurringEnd,
  monthBounds,
  shiftMonthKey,
} from './finance-service-utils.mjs';

export class DashboardService {
  constructor({entries,debts,incomes,budgets,recurring}) {
    this.entries = entries;
    this.debts = debts;
    this.incomes = incomes;
    this.budgets = budgets;
    this.recurring = recurring;
  }

  async get(user, month) {
    const monthKey = monthOnly(month);
    const [transactions, debts, goals, incomes, budgets, recurringExpenses] = await Promise.all([
      this.entries.list(user,'transactions'),
      this.debts.list(user),
      this.entries.list(user,'goals'),
      this.incomes.list(user),
      this.budgets.list(user,monthKey),
      this.recurring.list(user),
    ]);

    const calculateMonth = key => {
      const {start:monthStart,end:monthEnd} = monthBounds(key);
      const belongsToMonth = raw => Boolean(raw && raw.slice(0,7) === key);
      const monthly = transactions.filter(entry => belongsToMonth(entry.transactionDate));
      const spent = monthly.reduce((total, entry) => total + entry.value, 0);
      const activeSalaries = incomes.filter(entry => {
        const activeUntil = effectiveIncomeEnd(entry);
        return entry.type === 'salary'
          && entry.activeFrom <= monthEnd
          && (!activeUntil || activeUntil >= monthStart);
      });
      const salary = activeSalaries.reduce((total, entry) => total + entry.value, 0);
      const monthlyExtras = incomes.filter(entry => entry.type === 'extra' && belongsToMonth(entry.receivedAt));
      const extras = monthlyExtras.reduce((total, entry) => total + entry.value, 0);
      const paidRecurringIds = new Set(
        monthly
          .filter(entry => entry.recurringExpenseId && entry.recurringMonth === key)
          .map(entry => entry.recurringExpenseId),
      );
      const monthRecurring = recurringExpenses
        .filter(entry => {
          const activeUntil = effectiveRecurringEnd(entry);
          return entry.activeFrom <= monthEnd
            && (!activeUntil || activeUntil >= monthStart);
        })
        .map(entry => {
          const lastDay = Number(monthEnd.slice(8,10));
          const day = Math.min(entry.dueDay,lastDay);
          return {
            ...entry,
            scheduledDate:`${key}-${String(day).padStart(2,'0')}`,
            paid:paidRecurringIds.has(entry.id),
          };
        });
      const recurringTotal = monthRecurring
        .filter(entry => !entry.paid)
        .reduce((total, entry) => total + entry.value, 0);
      const income = salary + extras;
      return {
        monthly,
        spent,
        activeSalaries,
        salary,
        monthlyExtras,
        extras,
        income,
        recurringExpenses:monthRecurring,
        recurringTotal,
        projectedSpent:spent + recurringTotal,
        projectedBalance:income - spent - recurringTotal,
      };
    };

    const current = calculateMonth(monthKey);
    const debt = debts.reduce((total, entry) => total + entry.currentBalance, 0);
    const debtOriginal = debts.reduce((total, entry) => total + entry.originalAmount, 0);
    const debtPaid = debts.reduce((total, entry) => total + entry.paidAmount, 0);
    const saved = goals.reduce((total, entry) => total + entry.saved, 0);
    const targets = goals.reduce((total, entry) => total + entry.target, 0);

    const categoriesData = categories.map(category => {
      const total = current.monthly
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.value, 0);
      return {
        category,
        total,
        share:current.spent > 0 ? (total / current.spent) * 100 : 0,
      };
    }).filter(item => item.total > 0);

    const budgetData = categories.map(category => {
      const budget = budgets.find(item => item.category === category) ?? null;
      const categorySpent = current.monthly
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.value, 0);
      const limit = budget?.limit ?? 0;
      return {
        category,
        budget,
        limit,
        spent:categorySpent,
        remaining:limit - categorySpent,
        usage:limit > 0 ? (categorySpent / limit) * 100 : 0,
      };
    });
    const budgetTotal = budgetData.reduce((total, item) => total + item.limit, 0);
    const budgetedSpent = budgetData
      .filter(item => item.limit > 0)
      .reduce((total, item) => total + item.spent, 0);

    const historyData = Array.from({length:6},(_,index) => shiftMonthKey(monthKey,index-5))
      .map(key => {
        const snapshot = calculateMonth(key);
        return {
          monthKey:key,
          income:snapshot.income,
          expenses:snapshot.spent,
          balance:snapshot.income - snapshot.spent,
        };
      });

    return {
      month:monthKey,
      ...current,
      balance:current.income - current.spent,
      debt,
      debtOriginal,
      debtPaid,
      debtProgress:debtOriginal > 0 ? (debtPaid / debtOriginal) * 100 : 0,
      debtMonths:current.income > 0 ? debt / current.income : 0,
      saved,
      targets,
      goalProgress:targets > 0 ? (saved / targets) * 100 : 0,
      categoriesData,
      budgetData,
      budgetTotal,
      budgetedSpent,
      budgetRemaining:budgetTotal - budgetedSpent,
      budgetUsage:budgetTotal > 0 ? (budgetedSpent / budgetTotal) * 100 : 0,
      historyData,
    };
  }


}
