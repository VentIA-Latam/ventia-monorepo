"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const handleLogin = () => {
    // Redirect to Auth0 login with returnTo pointing to dashboard
    window.location.href = "/auth/login?returnTo=/dashboard";
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Brand Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-[url('/images/imagen-hero-desktop.avif')] bg-cover relative overflow-hidden">
        {/* Background Pattern/Image - Replace with your image */}
        <div className="absolute inset-0 opacity-80">
          {/* Placeholder for background pattern image */}
          <Image
            src="/images/logo-ventia-blanco.png"
            alt="Background pattern"
            fill
            className="object-cover"
          />
          <div className="w-full h-full bg-[url('/images/logo-ventia-blanco.png')] bg-cover bg-center"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-gray-500 w-full h-full">
          {/* Logo and Brand */}
          <div className="flex items-center gap-1">
            <div className="rounded-lg flex items-center justify-center overflow-hidden">
              <Image
                src="/images/logo-ventia-header.png"
                alt="Ventia Logo"
                width={180}
                height={60}
                className="object-contain"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 max-w-md">
            <p className="text-lg leading-relaxed">
              Centraliza tus operaciones. Gestiona pedidos, logística y
              facturación en una plataforma unificada diseñada para
              escalar tu negocio.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
              <Image
                src="/images/auth/Logos-07.png"
                alt="Ventia Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="text-xl font-bold">Ventia</span>
          </div>

          {/* Form Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Bienvenido a Ventia
            </h1>
            <p className="text-gray-500">
              Gestiona tus pedidos y logística en un solo lugar
            </p>
          </div>

          {/* Login Button */}
          <div className="space-y-6">
            <Button
              onClick={handleLogin}
              className="w-full bg-[#48c1ec] hover:bg-[#379acb] text-white py-6 text-lg"
            >
              Iniciar Sesión
            </Button>
            <p className="text-center text-sm text-gray-500">
              Serás redirigido a nuestro portal de autenticación seguro
            </p>
          </div>

          {/* Footer */}
          <div className="text-center space-y-2 pt-6 border-t">
            <p className="text-xs text-gray-500">
              © 2025 Ventia. Todos los derechos reservados.
            </p>
            <Link
              href="/support"
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline inline-block"
            >
              Contactar Soporte
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
