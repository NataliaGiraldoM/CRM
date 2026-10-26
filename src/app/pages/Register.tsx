import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../../i18n/LanguageContext";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Lock, Mail, User } from "lucide-react";
import { AuthService, type RegisterData } from "../../services/auth.service";

export default function Register() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validaciones del frontend
      if (!name || !email || !password || !confirmPassword) {
        setError("Please fill in all fields");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      // Enviar datos al backend
      const registerData: RegisterData = { name, email, password };
      const result = await AuthService.registerUser(registerData);
      
      console.log("Registration successful:", result);
      
      // Redirigir a login después del registro exitoso
      navigate("/login");
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="orbit-language-auth"><LanguageSwitcher /></div>
        {/* Header */}
        <div className="login-header">
          <div className="logo-container">
            <Building2 className="logo-icon" />
          </div>
          <h1 className="login-title">CRM Cloud</h1>
          <p className="login-subtitle">{t("Create your account")}</p>
        </div>

        {/* Card */}
        <div className="login-card">
          <div className="card-header">
            <h2 className="card-title">{t("Sign Up")}</h2>
            <p className="card-description">{t("Start managing your customers in the cloud")}</p>
          </div>

          <div className="card-body">
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  {t("Full Name")}
                </label>
                <div className="input-wrapper">
                  <User className="input-icon" />
                  <input
                    id="name"
                    type="text"
                    placeholder={t("John Doe")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  {t("Email")}
                </label>
                <div className="input-wrapper">
                  <Mail className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    placeholder={t("you@company.com")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  {t("Password")}
                </label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  {t("Confirm Password")}
                </label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {error && <div className="error-message">{t(error)}</div>}

              <button 
                type="submit" 
                className="submit-button"
                disabled={loading}
              >
                {loading ? t("Creating Account...") : t("Create Account")}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t("Already have an account?")}{" "}
                <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  {t("Sign in")}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="footer-text">
          <p>{t("Cloud Migration MVP - Customer Management Module")}</p>
        </div>
      </div>
    </div>
  );
}