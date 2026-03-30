import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div className="min-h-[75vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-dark">
            inVision U
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Initiative of Arsen Tomsky powered by inDrive
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-full p-1 mb-8">
          <button
            className={`flex-1 py-2.5 text-center text-sm font-medium rounded-full transition ${
              tab === "login"
                ? "bg-dark text-white shadow-sm"
                : "text-gray-500 hover:text-dark"
            }`}
            onClick={() => setTab("login")}
          >
            Вход
          </button>
          <button
            className={`flex-1 py-2.5 text-center text-sm font-medium rounded-full transition ${
              tab === "register"
                ? "bg-dark text-white shadow-sm"
                : "text-gray-500 hover:text-dark"
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

const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-dark focus:border-transparent outline-none transition";
const btnClass = "w-full bg-dark text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50";

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
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@example.com" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Пароль</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Введите пароль" required />
      </div>
      <button type="submit" disabled={loading} className={btnClass}>
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Пароль должен содержать минимум 8 символов"); return; }
    setLoading(true);
    try {
      await register(name, email, phone, password);
      navigate(getDefaultRoute());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Ошибка регистрации";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Имя</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Ваше имя" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@example.com" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Телефон</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+7 (999) 123-45-67" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Пароль</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Минимум 8 символов" required minLength={8} />
      </div>
      <button type="submit" disabled={loading} className={btnClass}>
        {loading ? "Регистрация..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
