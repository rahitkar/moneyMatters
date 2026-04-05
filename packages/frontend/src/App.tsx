import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Transactions from './pages/Transactions';
import Performance from './pages/Performance';
import Tags from './pages/Tags';
import CashFlow from './pages/CashFlow';
import FireSimulator from './pages/FireSimulator';
import Import from './pages/Import';
import Reports from './pages/Reports';
import Help from './pages/Help';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/cash-flow" element={<CashFlow />} />
        <Route path="/fire" element={<FireSimulator />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/import" element={<Import />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </Layout>
  );
}
