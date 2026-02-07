"use client";

import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const ConversionRate = () => {
  // Data de ejemplo
  const conversacionesAbiertas = 150;
  const ventasCerradas = 45;
  const tasaConversion = ((ventasCerradas / conversacionesAbiertas) * 100).toFixed(1);

  const data = [
    {
      name: 'Tasa de Conversión',
      value: parseFloat(tasaConversion),
      fill: '#8884d8',
    }
  ];

  const COLORS = ['#00C49F', '#FFBB28'];

  const pieData = [
    { name: 'Ventas Cerradas', value: ventasCerradas },
    { name: 'Sin Cerrar', value: conversacionesAbiertas - ventasCerradas }
  ];

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Tasa de Conversión</h2>

      {/* KPI Principal */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#00C49F' }}>
          {tasaConversion}%
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
          {ventasCerradas} ventas cerradas de {conversacionesAbiertas} conversaciones
        </div>
      </div>

      {/* Gráfico de distribución */}
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent! * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ConversionRate;
