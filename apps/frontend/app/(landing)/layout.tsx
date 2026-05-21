// src/app/(landing)/layout.tsx
import WhatsAppButton from "@/components/common/WhatsAppButton";
import Header from "@/components/layout/Header";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-[oklch(0.20_0.03_250)] min-h-screen">
      <Header />
      {children}
      <WhatsAppButton />
    </div>
  );
}

