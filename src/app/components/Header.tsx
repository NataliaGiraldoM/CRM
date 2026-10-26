import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "../../i18n/LanguageContext";
import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  LayoutGrid,
  Users,
  CircleUserRound,
  LogOut,
  ChevronDown,
  PencilLine,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthService } from "../../services/auth.service";
import "../styles/header.scss";

export default function Header() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = AuthService.getAuthData();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const userName = user?.name || t("User");

  const handleToggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const handleGoCustomers = () => {
    setIsMenuOpen(false);
    navigate("/customers");
  };

  const handleEditProfile = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    setIsMenuOpen(false);

    if (typeof AuthService.clearAuthData === "function") {
      AuthService.clearAuthData();
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    navigate("/login");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="crm-header">
      <div className="crm-header__container">
        <div className="crm-header__brand">
          <div className="crm-header__logo">
            <Cloud size={28} strokeWidth={2.2} />
          </div>

          <div className="crm-header__brand-text">
            <h1 className="crm-header__title">{t("CRM Analytics")}</h1>
            <p className="crm-header__subtitle">{t("Cloud Migration MVP")}</p>
          </div>
        </div>

        <div className="crm-header__actions">
          <LanguageSwitcher />
          <nav className="crm-header__nav" aria-label={t("Primary navigation")}>
            <NavLink
              to="/dashboard"
              onClick={handleCloseMenu}
              className={({ isActive }) =>
                `crm-header__nav-item ${isActive ? "is-active" : ""}`
              }
            >
              <LayoutGrid size={20} />
              <span>{t("Analytics")}</span>
            </NavLink>

            <NavLink
              to="/customers"
              onClick={handleCloseMenu}
              className={({ isActive }) =>
                `crm-header__nav-item ${isActive ? "is-active" : ""}`
              }
            >
              <Users size={20} />
              <span>{t("Customers")}</span>
            </NavLink>
          </nav>

          <div className="crm-header__profile-wrapper" ref={menuRef}>
            <button
              type="button"
              className="crm-header__profile"
              onClick={handleToggleMenu}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <CircleUserRound size={22} />
              <span className="crm-header__profile-name">{userName}</span>
              <ChevronDown
                size={18}
                className={`crm-header__chevron ${isMenuOpen ? "is-open" : ""}`}
              />
            </button>

            {isMenuOpen && (
              <div className="crm-header__dropdown" role="menu">
                <div className="crm-header__dropdown-title">{t("My Account")}</div>

                <button
                  type="button"
                  className="crm-header__dropdown-item"
                  onClick={handleEditProfile}
                >
                  <PencilLine size={18} />
                  <span>{t("Edit Profile")}</span>
                </button>

                <button
                  type="button"
                  className="crm-header__dropdown-item"
                  onClick={handleLogout}
                >
                  <LogOut size={18} />
                  <span>{t("Logout")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}