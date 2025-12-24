"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auth0 logic will go here
    console.log("Login attempt:", { email, password, rememberMe });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Brand Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-[#0a2f3f] via-[#0f4a5f] to-[#1a6f7f] relative overflow-hidden">
        {/* Background Pattern/Image - Replace with your image */}
        <div className="absolute inset-0 opacity-20">
          {/* Placeholder for background pattern image */}
          {/* <Image
            src="/images/auth/login-background.png"
            alt="Background pattern"
            fill
            className="object-cover"
          /> */}
          <div className="w-full h-full bg-[url('/images/auth/login-background.png')] bg-cover bg-center"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full h-full">
          {/* Logo and Brand */}
          <div className="flex items-center gap-1">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
              <Image
                src="/images/auth/Logos-06.png"
                alt="Ventia Logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold">Ventia</span>
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

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="remember"
                  className="text-sm text-gray-600 cursor-pointer"
                >
                  Recordarme
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Iniciar Sesión
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center space-y-2 pt-6 border-t">
            <p className="text-xs text-gray-500">
              © 2024 Ventia. Todos los derechos reservados.
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
