import LoginForm from './components/LoginForm';
import HeroSection from './components/HeroSection';

export const metadata = {
  title: 'Login - Compliance Web',
  description: 'Admin login page',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Hero Section */}
      <HeroSection />

      {/* Login Form Section */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <LoginForm />
      </div>
    </div>
  );
}
