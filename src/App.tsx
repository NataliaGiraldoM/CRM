import Inventory from "./app/pages/Inventory";
import Profile from "./app/pages/Profile";
import Products from "./app/pages/Products";
import AccessGuard from "./app/components/AccessGuard";
import Users from "./app/pages/Users";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./app/pages/Login";
import Register from "./app/pages/Register";
import Dashboard from "./app/pages/Dashboard";
import Customers from "./app/pages/Customers";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<AccessGuard><Dashboard /></AccessGuard>} />
      <Route path="/customers" element={<AccessGuard><Customers /></AccessGuard>} />

      <Route path="/profile" element={<AccessGuard><Profile /></AccessGuard>} />
      <Route path="/inventory" element={<AccessGuard><Inventory /></AccessGuard>} />
      <Route path="/products" element={<AccessGuard><Products /></AccessGuard>} />
      <Route path="/users" element={<AccessGuard admin><Users /></AccessGuard>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
