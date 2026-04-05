import { useEffect, useState } from "react";
import apiClient from "../api/client";
import { useAuthStore } from "../store/authStore";

interface ProfileData {
  id: number;
  email: string;
  phone: string;
  name: string;
  role: string;
  bio: string;
  avatar_url: string | null;
}

const roleLabels: Record<string, string> = {
  candidate: "Абитуриент",
  manager: "Приёмная комиссия",
  hr: "Координатор отбора",
};

export default function ProfilePage() {
  const { refreshUser } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get("/profile/")
      .then((res) => {
        setProfile(res.data);
        setName(res.data.name);
        setPhone(res.data.phone);
        setBio(res.data.bio || "");
      })
      .catch(() => setError("Не удалось загрузить профиль"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const { data } = await apiClient.put("/profile/", { name, phone, bio });
      setProfile(data);
      setMessage("Профиль обновлён");
      await refreshUser();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Ошибка сохранения";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await apiClient.post("/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfile((prev) =>
        prev ? { ...prev, avatar_url: data.avatar_url } : prev
      );
      await refreshUser();
      setMessage("Фото обновлено");
    } catch {
      setError("Ошибка загрузки фото (макс. 5MB, только изображения)");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <p className="text-gray-500">Загрузка...</p>;
  if (!profile) return <p className="text-red-500">Ошибка загрузки профиля</p>;

  const avatarSrc = profile.avatar_url
    ? `${profile.avatar_url}`
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold mb-8">Профиль</h2>

      {/* Avatar section */}
      <div className="bg-white rounded-xl shadow p-6 mb-6 flex items-center gap-6">
        <div className="relative">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Аватар"
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center text-dark text-3xl font-bold">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-lg">{profile.name}</p>
          <p className="text-gray-500 text-sm">{profile.email}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-accent text-dark rounded text-xs">
            {roleLabels[profile.role] || profile.role}
          </span>
          <div className="mt-3">
            <label className="cursor-pointer text-dark hover:text-gray-600 text-sm font-medium">
              {uploading ? "Загрузка..." : "Изменить фото"}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-6 space-y-4">
        {message && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">
            {message}
          </div>
        )}
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
            className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-dark"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Телефон
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-dark"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={profile.email}
            className="w-full border rounded-lg px-4 py-2 bg-gray-50 text-gray-500"
            disabled
          />
          <p className="text-xs text-gray-400 mt-1">Email нельзя изменить</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            О себе
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 h-28 focus:ring-2 focus:ring-dark"
            placeholder="Расскажите о себе..."
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-dark text-white py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </form>

      {/* Telegram linking */}
      <TelegramLink />
    </div>
  );
}

function TelegramLink() {
  const [code, setCode] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get("/telegram/link-status").then(({ data }) => {
      setLinked(data.linked);
      setTgUsername(data.telegram_username);
    }).catch(() => {});
  }, []);

  const generateCode = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.post("/telegram/generate-code");
      setCode(data.code);
      setSeconds(data.expires_in);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (seconds <= 0) { setCode(null); return; }
    const timer = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          // Check if linked while code was active
          apiClient.get("/telegram/link-status").then(({ data }) => {
            if (data.linked) { setLinked(true); setTgUsername(data.telegram_username); }
          }).catch(() => {});
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  return (
    <div className="border border-gray-100 rounded-2xl p-6 mt-8">
      <h3 className="font-bold text-dark mb-2">Telegram</h3>

      {linked ? (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-dark font-bold">TG</div>
          <div>
            <p className="text-dark font-medium">Подключён к аккаунту {tgUsername ? `@${tgUsername}` : "Telegram"}</p>
            <p className="text-gray-400 text-xs">Вы получаете уведомления о статусе заявки</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-gray-400 text-sm mb-4">Привяжите Telegram чтобы получать уведомления о статусе заявки</p>
          {code && seconds > 0 ? (
            <div className="text-center">
              <div className="text-4xl font-extrabold text-dark tracking-[0.3em] mb-2">{code}</div>
              <p className="text-sm text-gray-400">Введите этот код в Telegram-боте</p>
              <p className="text-xs text-red-500 mt-1">Истекает через {seconds} сек.</p>
            </div>
          ) : (
            <button
              onClick={generateCode}
              disabled={loading}
              className="bg-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "..." : "Получить код для Telegram"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
