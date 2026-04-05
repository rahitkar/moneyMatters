import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  HelpCircle,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  Banknote,
  Flame,
  FileBarChart,
  Tag,
  Upload,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Landmark,
  CreditCard,
  PiggyBank,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Repeat,
  Target,
} from 'lucide-react';
import Card from '../components/Card';

type SectionId =
  | 'getting-started'
  | 'monthly-flow'
  | 'assets'
  | 'cash-flow'
  | 'transactions'
  | 'import'
  | 'performance'
  | 'fire'
  | 'reports'
  | 'concepts'
  | 'faq';

const SECTIONS: { id: SectionId; title: string; icon: React.ElementType }[] = [
  { id: 'getting-started', title: 'Getting Started', icon: CheckCircle2 },
  { id: 'monthly-flow', title: 'Your Monthly Flow', icon: Repeat },
  { id: 'concepts', title: 'Key Concepts', icon: Lightbulb },
  { id: 'assets', title: 'Assets', icon: Wallet },
  { id: 'cash-flow', title: 'Cash Flow', icon: Banknote },
  { id: 'transactions', title: 'Transactions', icon: ArrowLeftRight },
  { id: 'import', title: 'Import Data', icon: Upload },
  { id: 'performance', title: 'Performance', icon: TrendingUp },
  { id: 'fire', title: 'FIRE Simulator', icon: Flame },
  { id: 'reports', title: 'Reports', icon: FileBarChart },
  { id: 'faq', title: 'FAQ & Tips', icon: HelpCircle },
];

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-surface-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-surface-800/30 transition-colors"
      >
        <span className="text-sm font-medium text-surface-200">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
      </button>
      {open && <div className="px-5 pb-4 text-sm text-surface-400 leading-relaxed">{children}</div>}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-6 h-6 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-xs font-bold text-brand-400">{n}</span>
      </div>
      <div className="text-sm text-surface-300 leading-relaxed">{children}</div>
    </div>
  );
}

function NavChip({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600/20 text-brand-400 text-xs font-medium hover:bg-brand-600/30 transition-colors">
      {label} <ArrowRight className="w-3 h-3" />
    </Link>
  );
}

export default function Help() {
  const [activeSection, setActiveSection] = useState<SectionId>('getting-started');

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in">
      <div className="flex items-center gap-3 shrink-0 mb-6">
        <HelpCircle className="w-6 h-6 text-brand-400" />
        <h1 className="text-2xl font-bold text-surface-100">Help & Guide</h1>
      </div>

      <div className="flex-1 min-h-0 flex gap-6">
        {/* Sidebar TOC */}
        <div className="w-52 shrink-0 overflow-y-auto pr-2">
          <nav className="space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                  activeSection === s.id
                    ? 'bg-brand-600/20 text-brand-400 font-medium'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/40'
                )}
              >
                <s.icon className="w-4 h-4 shrink-0" />
                {s.title}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-5">

          {/* ── Getting Started ──────────────────────────────────── */}
          {activeSection === 'getting-started' && (
            <>
              <Card>
                <h2 className="text-lg font-semibold text-surface-100 mb-4">First-Time Setup</h2>
                <p className="text-sm text-surface-400 mb-5">
                  Money Matters is a personal finance tracker that connects your bank account, investment platforms, expenses, and long-term goals into one unified view. Here's how to get started:
                </p>
                <div className="space-y-4">
                  <Step n={1}>
                    <p><strong className="text-surface-200">Create your bank account</strong> — Go to <NavChip to="/assets" label="Assets" /> and click <em>Add Manual Asset</em>. Choose "Savings Account", name it (e.g. "Kotak Savings"), and enter your current balance. This is the hub of all money flows.</p>
                  </Step>
                  <Step n={2}>
                    <p><strong className="text-surface-200">Create broker wallets</strong> — Similarly, create cash-class assets for each investment platform you use: "Zerodha Wallet", "Ind Money Wallet", etc. Set their current wallet balance.</p>
                  </Step>
                  <Step n={3}>
                    <p><strong className="text-surface-200">Import your holdings</strong> — Go to <NavChip to="/import" label="Import" /> and upload your Zerodha tradebook CSV or holdings CSV. The system auto-maps fund sources (Zerodha stocks deduct from Zerodha Wallet, MF purchases deduct from Bank).</p>
                  </Step>
                  <Step n={4}>
                    <p><strong className="text-surface-200">Set up cash flow</strong> — Go to <NavChip to="/cash-flow" label="Cash Flow" /> and initialize the current month. Create expense categories (Rent, Groceries, etc.) and payment methods (Credit Cards, UPI, Cash). Set your monthly targets.</p>
                  </Step>
                  <Step n={5}>
                    <p><strong className="text-surface-200">Log your income</strong> — Add income as a spend entry with type "income" (e.g. Salary, Freelance). Income is just another type of cash flow entry.</p>
                  </Step>
                  <Step n={6}>
                    <p><strong className="text-surface-200">Set up FIRE goals</strong> — Go to <NavChip to="/fire" label="FIRE" /> to create retirement scenarios. The system tracks your progress against these goals each month.</p>
                  </Step>
                </div>
              </Card>
            </>
          )}

          {/* ── Monthly Flow ────────────────────────────────────── */}
          {activeSection === 'monthly-flow' && (
            <>
              <Card>
                <h2 className="text-lg font-semibold text-surface-100 mb-4">Your Monthly Workflow</h2>
                <p className="text-sm text-surface-400 mb-5">
                  Here's a typical month mapped to app sections. The billing cycle is configurable (e.g. 26th to 25th).
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-3">
                      <CalendarDays className="w-4 h-4 text-brand-400" /> Salary Day (e.g. 25th)
                    </h3>
                    <div className="space-y-2 ml-6">
                      <Step n={1}><p>Open <NavChip to="/cash-flow" label="Cash Flow" /> and add an income entry: category "Salary", amount, date.</p></Step>
                      <Step n={2}><p>Click the config bar to set this month's <strong className="text-surface-200">Opening Bank Balance</strong> (your bank balance after salary arrives).</p></Step>
                      <Step n={3}><p>Set monthly targets: <strong className="text-surface-200">Expense Limit</strong>, <strong className="text-surface-200">Investment Target</strong>, <strong className="text-surface-200">Savings Target</strong>.</p></Step>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-red-400" /> Throughout the Month
                    </h3>
                    <div className="space-y-2 ml-6">
                      <Step n={4}><p>Log every expense as it happens: category, amount, payment method (CC, UPI, Cash), date.</p></Step>
                      <Step n={5}><p>Any other income (freelance, dividends) — add as income-type spend entries.</p></Step>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-green-400" /> Investment Days
                    </h3>
                    <div className="space-y-2 ml-6">
                      <Step n={6}><p>When you deposit money to Zerodha/Ind Money: go to <NavChip to="/assets" label="Assets" />, find the wallet, click Deposit, select "From Account" = your bank.</p></Step>
                      <Step n={7}><p>When you buy stocks/MF: log the transaction with the fund source = the wallet or bank it was paid from.</p></Step>
                      <Step n={8}><p>Selling works the same way — proceeds go "To Account" = the destination wallet.</p></Step>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-3">
                      <Landmark className="w-4 h-4 text-blue-400" /> Month End
                    </h3>
                    <div className="space-y-2 ml-6">
                      <Step n={9}><p>Review the <strong className="text-surface-200">Bank Waterfall</strong> on Cash Flow — it shows Opening + Income − Expenses − CC Bill − Investment = Savings.</p></Step>
                      <Step n={10}><p>Check target progress bars. Generate a <NavChip to="/reports" label="Report" /> for the month.</p></Step>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2 mb-3">
                      <Repeat className="w-4 h-4 text-amber-400" /> Periodic
                    </h3>
                    <div className="space-y-2 ml-6">
                      <Step n={11}><p>Import new tradebook CSVs from Zerodha after buying/selling stocks.</p></Step>
                      <Step n={12}><p>Update manual asset balances (PPF, EPF, FDs) quarterly or when statements arrive.</p></Step>
                      <Step n={13}><p>Review <NavChip to="/performance" label="Performance" /> charts and FIRE progress.</p></Step>
                    </div>
                  </div>
                </div>
              </Card>

              <Card padding="sm">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-surface-400">
                    <strong className="text-surface-200">Retroactive entries:</strong> You can always add or edit entries for past months. The system recalculates everything based on transaction dates, so filling in data days or weeks later works perfectly.
                  </p>
                </div>
              </Card>
            </>
          )}

          {/* ── Key Concepts ────────────────────────────────────── */}
          {activeSection === 'concepts' && (
            <>
              <Card>
                <h2 className="text-lg font-semibold text-surface-100 mb-4">Key Concepts</h2>
                <div className="space-y-4">
                  <Accordion title="Connected Financial Ledger" defaultOpen>
                    <p className="mb-2">Every rupee is tracked from source to destination. When you buy stocks, the money flows from your Bank → Zerodha Wallet → Stock. When you sell, it flows back.</p>
                    <p>This is achieved through the <strong className="text-surface-200">Fund Source</strong> field on every transaction. The system uses this to automatically compute wallet balances and investment totals.</p>
                  </Accordion>

                  <Accordion title="Fund Source">
                    <p className="mb-2">When you buy an asset, the <strong className="text-surface-200">Fund Source</strong> tells the system which account the money came from. When you sell, it tells where the proceeds go.</p>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Buy stocks on Zerodha → Fund Source = "Zerodha Wallet"</li>
                      <li>Buy mutual funds → Fund Source = "Kotak Bank" (MFs debit bank directly)</li>
                      <li>Deposit to Zerodha → Fund Source = "Kotak Bank"</li>
                      <li>Sell stocks → Proceeds To = "Zerodha Wallet"</li>
                    </ul>
                  </Accordion>

                  <Accordion title="Cash-Class Assets (Accounts & Wallets)">
                    <p className="mb-2">Your bank accounts and broker wallets are modeled as <strong className="text-surface-200">cash-class assets</strong>. They have a balance derived from all deposits, withdrawals, and fund-source references.</p>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li><strong className="text-surface-200">Kotak Savings Account</strong> — your primary bank (the hub)</li>
                      <li><strong className="text-surface-200">Zerodha Wallet</strong> — for stock trading</li>
                      <li><strong className="text-surface-200">Ind Money Wallet</strong> — for US stocks</li>
                    </ul>
                    <p className="mt-2">Create these as "Savings Account" type under Assets.</p>
                  </Accordion>

                  <Accordion title="Billing Cycle">
                    <p className="mb-2">Your monthly cycle doesn't have to be 1st–31st. If your salary arrives on the 25th, set the cycle to start on the 26th. All expenses between the 26th of the previous month and 25th of the current month will be bucketed into that cycle.</p>
                    <p>Configure this in <NavChip to="/cash-flow" label="Cash Flow" /> → Settings (gear icon).</p>
                  </Accordion>

                  <Accordion title="The Monthly Equation">
                    <div className="bg-surface-800/50 rounded-lg p-3 font-mono text-xs text-surface-200 my-2">
                      Opening Balance + Income = Expenses + Investment + Savings
                    </div>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li><strong className="text-surface-200">Opening Balance</strong> — your bank balance when the cycle starts</li>
                      <li><strong className="text-surface-200">Income</strong> — all income-type spend entries (salary, freelance, dividends)</li>
                      <li><strong className="text-surface-200">Expenses</strong> — all expense-type spend entries (CC, cash, UPI, bank transfer)</li>
                      <li><strong className="text-surface-200">Investment</strong> — money moved from bank to investment platforms</li>
                      <li><strong className="text-surface-200">Savings</strong> — what's left in the bank (auto-derived)</li>
                    </ul>
                  </Accordion>

                  <Accordion title="Income Tracking">
                    <p>Salary is treated as a regular income entry — not a special field. You can have multiple income sources per month (salary, freelance, rental, dividends). All income is logged as cash flow spends with type = "income".</p>
                  </Accordion>

                  <Accordion title="Credit Card Handling">
                    <p className="mb-2">Individual CC purchases are logged as expenses on the date of purchase. The total CC bill (sum of all CC payment method spends) is shown as a single line in the bank waterfall view.</p>
                    <p>The CC bill represents money leaving your bank to settle the card — it's not a separate expense, just the aggregation of individual swipes.</p>
                  </Accordion>
                </div>
              </Card>
            </>
          )}

          {/* ── Assets ──────────────────────────────────────────── */}
          {activeSection === 'assets' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-brand-400" /> Assets
              </h2>
              <div className="space-y-4 text-sm text-surface-400 leading-relaxed">
                <p>The <NavChip to="/assets" label="Assets" /> page is the portfolio hub. It shows every financial instrument you own.</p>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Asset Types</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong className="text-surface-200">Stocks & ETFs</strong> — Indian & international equities, auto-priced via Yahoo Finance</li>
                    <li><strong className="text-surface-200">Mutual Funds</strong> — equity, debt, classified automatically on import</li>
                    <li><strong className="text-surface-200">Savings Accounts</strong> — bank accounts and broker wallets (cash-class)</li>
                    <li><strong className="text-surface-200">Fixed Deposits, PPF, EPF, NPS</strong> — manual-entry assets with interest rates</li>
                    <li><strong className="text-surface-200">Gold, Silver</strong> — tracked by weight (grams) and price per gram</li>
                    <li><strong className="text-surface-200">Lended Money</strong> — track loans you've given with expected return dates</li>
                    <li><strong className="text-surface-200">Real Estate, Vehicles</strong> — high-value non-liquid assets</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Actions</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong className="text-surface-200">Add Asset</strong> — search by symbol (auto-creates via market data) or add manually</li>
                    <li><strong className="text-surface-200">Deposit / Withdraw</strong> — for cash-class assets (bank, wallets)</li>
                    <li><strong className="text-surface-200">Update Balance</strong> — snapshot the current value of manual assets</li>
                    <li><strong className="text-surface-200">Buy / Sell</strong> — for metals; with fund source selection</li>
                    <li><strong className="text-surface-200">Apply Split</strong> — adjust for stock splits</li>
                    <li><strong className="text-surface-200">Tags</strong> — categorize assets (e.g. "Long Term", "International")</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Transaction History</h3>
                  <p>Expand any asset row to see its full buy/sell history. Each transaction shows the date, quantity, price, P&L, and the <strong className="text-surface-200">Fund Source</strong> — the account money came from or went to.</p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Cash Flow ───────────────────────────────────────── */}
          {activeSection === 'cash-flow' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <Banknote className="w-5 h-5 text-brand-400" /> Cash Flow
              </h2>
              <div className="space-y-4 text-sm text-surface-400 leading-relaxed">
                <p>The <NavChip to="/cash-flow" label="Cash Flow" /> page tracks your monthly income, expenses, and where the money goes.</p>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Setting Up a Month</h3>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Navigate to the desired month using the month selector</li>
                    <li>Click <em>Initialize Month</em> to copy category budgets from the previous month</li>
                    <li>Click the config bar to set opening balance and targets</li>
                  </ol>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Logging Expenses & Income</h3>
                  <p>Use the <em>Add Spend</em> form at the top:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Choose <strong className="text-surface-200">type</strong>: Expense or Income</li>
                    <li>Select a <strong className="text-surface-200">category</strong> (e.g. Rent, Groceries, Salary)</li>
                    <li>Select a <strong className="text-surface-200">payment method</strong> (Credit Card, UPI, Cash, Bank Transfer)</li>
                    <li>Enter amount, description, and date</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Bank Waterfall</h3>
                  <p>The waterfall shows your bank account flow for the month:</p>
                  <div className="bg-surface-800/50 rounded-lg p-3 text-xs font-mono text-surface-300 mt-2 space-y-0.5">
                    <div>Opening Balance ........ +1,80,847</div>
                    <div>+ Income (Salary) ...... +2,10,000</div>
                    <div>- Cash/UPI Expenses ..... -10,000</div>
                    <div>- CC Bill .............. -20,000</div>
                    <div>- Investment Transfers .. -1,30,000</div>
                    <div className="border-t border-surface-600 pt-1 text-surface-200">= Savings .............. 30,847</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Categories & Payment Methods</h3>
                  <p>Create custom categories (expense or income) and payment methods via the gear and + icons. Each expense category can be tagged as "Need" or "Luxury" for breakdown analysis.</p>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Billing Cycle</h3>
                  <p>If your salary cycle is 25th-to-25th, set the cycle start day to 26 in Settings. All expense dates are automatically bucketed into the correct cycle month.</p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Transactions ────────────────────────────────────── */}
          {activeSection === 'transactions' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <ArrowLeftRight className="w-5 h-5 text-brand-400" /> Transactions
              </h2>
              <div className="space-y-4 text-sm text-surface-400 leading-relaxed">
                <p>The <NavChip to="/transactions" label="Transactions" /> page shows a unified log of all buy/sell transactions across all assets.</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Every row shows the asset, type (buy/sell), quantity, price, date, and fund source</li>
                  <li>Transactions drive FIFO cost-basis calculations and realized gains</li>
                  <li>Deleting a transaction recalculates positions and realized gains</li>
                </ul>
                <p className="mt-2">
                  <strong className="text-surface-200">Fund Source</strong> on each transaction tells the system which wallet/account was debited (for buys) or credited (for sells). This keeps all account balances in sync.
                </p>
              </div>
            </Card>
          )}

          {/* ── Import ──────────────────────────────────────────── */}
          {activeSection === 'import' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <Upload className="w-5 h-5 text-brand-400" /> Import Data
              </h2>
              <div className="space-y-4 text-sm text-surface-400 leading-relaxed">
                <p>The <NavChip to="/import" label="Import" /> page lets you bulk-import holdings and transactions from CSV files.</p>

                <Accordion title="Zerodha Stocks" defaultOpen>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to Zerodha Console → Tradebook → Download CSV</li>
                    <li>Upload the CSV under "Zerodha Stocks" tab</li>
                    <li>The system auto-creates assets, detects ETFs, and maps the fund source to your Zerodha Wallet</li>
                    <li>Multiple CSV files can be uploaded at once</li>
                  </ol>
                </Accordion>

                <Accordion title="Zerodha Mutual Funds">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to Zerodha Coin → Reports → Tradebook → Download CSV</li>
                    <li>Upload under "Zerodha Mutual Funds" tab</li>
                    <li>Funds are auto-classified as equity/debt and the fund source defaults to your Bank account (MFs debit bank directly via SIP mandate)</li>
                  </ol>
                </Accordion>

                <Accordion title="Holdings CSV (Generic)">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Prepare a CSV with columns: Symbol, Name, Quantity, Purchase Price, Purchase Date</li>
                    <li>Upload under "Holdings CSV" tab and map your columns</li>
                    <li>Select a <strong className="text-surface-200">Fund Source</strong> from the dropdown — this tells the system which account these were purchased from</li>
                  </ol>
                </Accordion>

                <div className="bg-surface-800/50 rounded-lg p-3 flex items-start gap-2 mt-2">
                  <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-surface-400">
                    <strong className="text-surface-200">Tip:</strong> You can re-import the same tradebook after new trades — existing transactions are matched by date+symbol to avoid duplicates.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Performance ─────────────────────────────────────── */}
          {activeSection === 'performance' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-brand-400" /> Performance
              </h2>
              <div className="space-y-4 text-sm text-surface-400 leading-relaxed">
                <p>The <NavChip to="/performance" label="Performance" /> page shows portfolio returns over time and compares against benchmarks.</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong className="text-surface-200">Performance Curve</strong> — portfolio value over 1D, 1W, 1M, 3M, 6M, 1Y, YTD, or a custom date range</li>
                  <li><strong className="text-surface-200">Benchmark Comparison</strong> — compare your returns against Nifty 50, S&P 500, and other indices</li>
                  <li><strong className="text-surface-200">Asset Class Performance</strong> — see how each category (stocks, MF, gold, etc.) performed</li>
                  <li><strong className="text-surface-200">Tag Performance</strong> — performance grouped by your custom tags</li>
                </ul>
              </div>
            </Card>
          )}

          {/* ── FIRE ────────────────────────────────────────────── */}
          {activeSection === 'fire' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <Flame className="w-5 h-5 text-brand-400" /> FIRE Simulator
              </h2>
              <div className="space-y-4 text-sm text-surface-400 leading-relaxed">
                <p>The <NavChip to="/fire" label="FIRE" /> (Financial Independence, Retire Early) page helps you plan for retirement.</p>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Scenarios</h3>
                  <p>Create multiple scenarios (e.g. Base FIRE, Lean FIRE, Fat FIRE) with different parameters:</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Retirement age, life expectancy</li>
                    <li>Monthly savings, annual savings increase rate</li>
                    <li>Expected return on investment, capital gains tax</li>
                    <li>Post-retirement monthly expenses, inflation rate</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">Tracking</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Year-by-year projection table showing corpus growth</li>
                    <li>Monthly target comparison — how your actual investment compares to each scenario's target</li>
                    <li>Progress chart overlaying actual portfolio value against projected paths</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-surface-200 font-medium mb-2">How It Uses Your Data</h3>
                  <p>The FIRE tracker reads your actual income from cash flow entries and actual investments from transaction data. It compares these against your scenario targets to show if you're on track, ahead, or behind.</p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Reports ─────────────────────────────────────────── */}
          {activeSection === 'reports' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2 mb-4">
                <FileBarChart className="w-5 h-5 text-brand-400" /> Reports
              </h2>
              <div className="space-y-4 text-sm text-surface-400 leading-relaxed">
                <p>The <NavChip to="/reports" label="Reports" /> page generates consolidated summaries across all financial paradigms.</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong className="text-surface-200">Monthly Report</strong> — bank waterfall, expense breakdown pie chart, income vs expense stat cards, portfolio snapshot</li>
                  <li><strong className="text-surface-200">Quarterly Report</strong> — aggregated 3-month view with month-over-month bar chart and summary table</li>
                  <li><strong className="text-surface-200">Yearly Report</strong> — full financial year (Apr–Mar) with all 12 months, totals, charts, and portfolio position</li>
                  <li><strong className="text-surface-200">Export</strong> — use the Print button to generate a browser print / PDF for any report</li>
                </ul>
              </div>
            </Card>
          )}

          {/* ── FAQ ─────────────────────────────────────────────── */}
          {activeSection === 'faq' && (
            <Card>
              <h2 className="text-lg font-semibold text-surface-100 mb-4">FAQ & Tips</h2>
              <div className="space-y-3">
                <Accordion title="Can I add data for past months?" defaultOpen>
                  <p>Yes. All entries (expenses, income, transactions) work with any date. The system recalculates summaries based on dates, so retroactive entries are fully supported. You can fill in an entire past month at any time.</p>
                </Accordion>

                <Accordion title="My CC swipes are expenses. What about the CC bill payment?">
                  <p>Individual CC swipes are tracked as expenses (on the swipe date). The CC bill payment itself is <em>not</em> a separate expense — it's just money leaving your bank to settle the card. The bank waterfall shows "CC Bill" as the sum of all CC payment method expenses for the cycle, representing this bank-level deduction.</p>
                </Accordion>

                <Accordion title="What if I didn't invest this month but money is still in my bank?">
                  <p>Money sitting in your bank account after expenses counts as Savings (closing balance). The monthly equation derives this automatically. Investment only counts money that was explicitly moved to investment platforms or used for purchases.</p>
                </Accordion>

                <Accordion title="Moving money between accounts — is that an expense?">
                  <p>No. Transferring money from bank to Zerodha/Ind Money is <em>not</em> an expense. It's modeled as a deposit (buy) on the destination wallet with Fund Source = bank account. The bank balance decreases and the wallet balance increases — money just moved, net zero.</p>
                </Accordion>

                <Accordion title="How do I handle salary being deposited late?">
                  <p>Enter the salary income entry with the actual deposit date (e.g. 25th). Even if you log it days later, the system will place it in the correct billing cycle based on the date you enter.</p>
                </Accordion>

                <Accordion title="What's the difference between 'Refresh Prices' and 'Update Balance'?">
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong className="text-surface-200">Refresh Prices</strong> (sidebar button) — fetches the latest market prices for all auto-priced assets (stocks, ETFs, MFs) from Yahoo Finance</li>
                    <li><strong className="text-surface-200">Update Balance</strong> (per-asset button) — manually set the current value of a manual asset like PPF or EPF where there's no market feed</li>
                  </ul>
                </Accordion>

                <Accordion title="How does FIFO work for realized gains?">
                  <p>When you sell, the system matches against your oldest buy lots first (First-In, First-Out). This determines the cost basis and realized gain for tax purposes. The FIFO matching is fully automatic and recalculates if you add/delete transactions.</p>
                </Accordion>

                <Accordion title="Can I track assets in multiple currencies?">
                  <p>Yes. Each asset has a currency field (INR or USD). The dashboard and portfolio summary convert USD assets to INR using the live exchange rate. US stocks via Ind Money or other platforms are tracked in USD.</p>
                </Accordion>

                <Accordion title="How do I change my billing cycle?">
                  <p>Go to Cash Flow → click the Settings (gear) icon → change the Cycle Start Day. All existing expenses will be re-bucketed into the correct cycle months automatically.</p>
                </Accordion>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
