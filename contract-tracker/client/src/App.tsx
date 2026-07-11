import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ContractListPage from './pages/ContractListPage';
import ContractFormPage from './pages/ContractFormPage';
import ContractDetailPage from './pages/ContractDetailPage';
import UserManagePage from './pages/UserManagePage';
import PaymentTrackingPage from './pages/PaymentTrackingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/contracts" replace />} />
        <Route path="contracts" element={<ContractListPage />} />
        <Route path="contracts/new" element={<ContractFormPage />} />
        <Route path="contracts/:id" element={<ContractDetailPage />} />
        <Route path="contracts/:id/edit" element={<ContractFormPage />} />
        <Route path="payments" element={<PaymentTrackingPage />} />
        <Route path="users" element={<UserManagePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/contracts" replace />} />
    </Routes>
  );
}
