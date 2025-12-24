// src/app/(landing)/layout.tsx
import WhatsAppButton from "@/components/common/WhatsAppButton";
import Header from "@/components/layout/Header";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
      <WhatsAppButton />
    </>
  );
}
