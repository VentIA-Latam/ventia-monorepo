"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, Sector } from 'recharts';

const MetricasLeads = () => {
  // Embudo de ventas
  const embudoData = [
    { etapa: 'Contacto Inicial', cantidad: 250, porcentaje: 100, color: '#8884d8' },
    { etapa: 'Interés Confirmado', cantidad: 180, porcentaje: 72, color: '#83a6ed' },
    { etapa: 'Cotización Enviada', cantidad: 150, porcentaje: 60, color: '#8dd1e1' },
    { etapa: 'Negociación', cantidad: 95, porcentaje: 38, color: '#82ca9d' },
    { etapa: 'Cierre de Venta', cantidad: 45, porcentaje: 18, color: '#00C49F' },
  ];

  // Motivos de no cierre
  const motivosNoCierre = [
    { motivo: 'Precio Alto', cantidad: 45, color: '#FF6B6B' },
    { motivo: 'No Hay Presupuesto', cantidad: 38, color: '#FFA07A' },
    { motivo: 'Compró a Competencia', cantidad: 32, color: '#FFD93D' },
    { motivo: 'No es el Momento', cantidad: 28, color: '#95E1D3' },
    { motivo: 'Producto No Adecuado', cantidad: 22, color: '#A8E6CF' },
    { motivo: 'Sin Respuesta', cantidad: 40, color: '#C5C6C7' },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Métricas de Leads</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Embudo de Ventas */}
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Embudo de Ventas</h3>

          {/* Visualización de embudo con barras */}
          <div style={{ marginBottom: '30px' }}>
            {embudoData.map((item, index) => (
              <div key={index} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.etapa}</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: item.color }}>
                    {item.cantidad} ({item.porcentaje}%)
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '30px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '15px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${item.porcentaje}%`,
                    height: '100%',
                    backgroundColor: item.color,
                    transition: 'width 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}>
                    {item.porcentaje}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Estadísticas clave */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
              Tasa de Conversión Total
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00C49F' }}>
              18%
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              45 ventas de 250 contactos iniciales
            </div>
          </div>
        </div>

        {/* Motivos de No Cierre */}
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Motivos de No Cierre</h3>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={motivosNoCierre}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => `${props.motivo}: ${(props.percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="cantidad"
              >
                {motivosNoCierre.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${value} leads`} />
            </PieChart>
          </ResponsiveContainer>

          {/* Lista detallada */}
          <div style={{ marginTop: '20px' }}>
            {motivosNoCierre.sort((a, b) => b.cantidad - a.cantidad).map((item, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < motivosNoCierre.length - 1 ? '1px solid #eee' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: item.color,
                    borderRadius: '50%',
                    marginRight: '10px'
                  }} />
                  <span style={{ fontSize: '14px' }}>{item.motivo}</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {item.cantidad}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#fff3cd',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#856404'
          }}>
            <strong>💡 Insight:</strong> El 41% de los leads perdidos (83 de 205) se debe a precio o falta de presupuesto.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricasLeads;
