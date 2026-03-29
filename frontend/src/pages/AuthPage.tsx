import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-primary-600">
          Hakaron
        </h1>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            className={`flex-1 py-3 text-center font-medium transition ${
              tab === "login"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab("login")}
          >
            Вход
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium transition ${
              tab === "register"
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab("register")}
          >
            Регистрация
          </button>
        </div>

        {tab === "login" ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const { login, getDefaultRoute } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(getDefaultRoute());
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Ошибка входа";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="email@example.com"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Пароль
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Введите пароль"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}

function RegisterForm() {
  const navigate = useNavigate();
  const { register, getDefaultRoute } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      navigate(getDefaultRoute());
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Ошибка регистрации";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Имя
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Ваше имя"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="email@example.com"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Пароль
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Минимум 8 символов"
          required
          minLength={8}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? "Регистрация..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
