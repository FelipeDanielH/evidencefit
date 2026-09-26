import { AuthForm } from '../../components/auth/auth-form';

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <p className="eyebrow">EvidenceFit · v0.1</p>
      <h1>Crear cuenta</h1>
      <p>Registra una cuenta para ejecutar el flujo completo de la demo.</p>
      <AuthForm mode="register" />
    </main>
  );
}
