import { Outlet, Link, useNavigate } from "react-router-dom";
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

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-bold text-primary-600">
              inVision U
            </Link>

            {/* Role-based navigation */}
            {isAuthenticated && user && (
              <nav className="flex gap-4">
                {(roleNav[user.role] || []).map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="text-gray-600 hover:text-primary-600 font-medium"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                <Link to="/profile" className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-2">
                  {user.avatar_url && (
                    <img
                      src={`http://localhost:8000${user.avatar_url}`}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  )}
                  <span className="font-medium text-gray-700">{user.name}</span>
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs">
                    {roleLabels[user.role] || user.role}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-red-600 text-sm"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
