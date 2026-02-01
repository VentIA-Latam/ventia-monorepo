"use client";

import TasaConversion from './TasaConversion';
import ProductosMasVendidos from './ProductosMasVendidos';
import MetricasLeads from './MetricasLeads';
import Mapa from './Mapa';

const Dashboard = () => {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{
        textAlign: 'center',
        marginBottom: '30px',
        color: '#333',
        fontSize: '32px'
      }}>
        Dashboard de Ventas
      </h1>

      {/* Primera fila: Tasa de Conversión y Productos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '20px',
        marginBottom: '20px'
      }}>
        <TasaConversion />
        <ProductosMasVendidos />
      </div>

      {/* Segunda fila: Métricas de Leads */}
      <div style={{ marginBottom: '20px' }}>
        <MetricasLeads />
      </div>

      {/* Tercera fila: Mapa de Calor */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        height: '700px'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
          Mapa de Calor - Distritos de Compradores
        </h2>
        <Mapa />
      </div>
    </div>
  );
};

export default Dashboard;
