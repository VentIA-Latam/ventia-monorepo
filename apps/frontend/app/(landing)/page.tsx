// src/app/(landing)/page.tsx
import Hero from "@/components/landing/Hero";
import Solutions from "@/components/landing/Solutions";
import Steps from "@/components/landing/Steps";
import Plans from "@/components/landing/Plans";
import Contact from "@/components/landing/Contact"
import Footer from "@/components/layout/Footer"
import Clients from "@/components/landing/Clients"
import Faq from "@/components/landing/Faq";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Steps />
      <Solutions />
      <Plans />
      <Clients />
      <Faq limit={6} showMoreButton={true} />
      <Contact />
      <Footer />
    </main>
  );
}

