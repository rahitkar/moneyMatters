import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
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
import Login from './pages/Login';
import Register from './pages/Register';

function ProtectedRoutes() {
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-lg">M</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <ProtectedRoutes />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
