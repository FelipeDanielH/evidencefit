import { AuthForm } from '../../components/auth/auth-form';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <p className="eyebrow">EvidenceFit · v0.1</p>
      <h1>Iniciar sesión</h1>
      <p>Accede al entorno de demostración con tu cuenta.</p>
      <AuthForm mode="login" />
    </main>
  );
}
