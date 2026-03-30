import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

const roleLabels: Record<string, string> = {
  candidate: "Абитуриент",
  manager: "Приёмная комиссия",
  hr: "Координатор отбора",
};

const roleNav: Record<string, { to: string; label: string }[]> = {
  candidate: [
    { to: "/vacancies", label: "Программы" },
    { to: "/status", label: "Мой статус" },
  ],
  manager: [
    { to: "/manager", label: "Дашборд" },
  ],
  hr: [
    { to: "/hr", label: "Программы" },
    { to: "/hr/reports", label: "Отчёты" },
    { to: "/hr/statistics", label: "Статистика" },
    { to: "/hr/approved", label: "Одобренные" },
  ],
};

export default function MainLayout() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-dark">
                inVision U
              </span>
              <span className="text-[10px] text-gray-400 leading-tight hidden sm:block">
                Initiative of Arsen Tomsky<br />powered by inDrive
              </span>
            </Link>

            {isAuthenticated && user && (
              <nav className="hidden md:flex items-center gap-1">
                {(roleNav[user.role] || []).map((item) => {
                  const active = location.pathname === item.to ||
                    (item.to !== "/" && location.pathname.startsWith(item.to));
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        active
                          ? "bg-dark text-white"
                          : "text-gray-600 hover:text-dark hover:bg-gray-50"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-gray-50 transition"
                >
                  {user.avatar_url ? (
                    <img
                      src={`http://localhost:8000${user.avatar_url}`}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-dark text-white flex items-center justify-center text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-dark hidden sm:inline">
                    {user.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-accent rounded-full font-semibold text-dark hidden sm:inline">
                    {roleLabels[user.role] || user.role}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-400 hover:text-dark transition px-3 py-1.5"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="bg-dark text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-gray-400">
          <span>inVision U &copy; {new Date().getFullYear()}</span>
          <span>Initiative of Arsen Tomsky powered by inDrive</span>
        </div>
      </footer>
    </div>
  );
}
