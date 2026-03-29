import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function HomePage() {
  const { isAuthenticated, isLoading, getDefaultRoute } = useAuthStore();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={getDefaultRoute()} replace />;
  return <Navigate to="/auth" replace />;
}
