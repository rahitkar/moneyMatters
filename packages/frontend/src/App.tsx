import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Transactions from './pages/Transactions';
import Performance from './pages/Performance';
import Tags from './pages/Tags';
import Import from './pages/Import';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/import" element={<Import />} />
      </Routes>
    </Layout>
  );
}
