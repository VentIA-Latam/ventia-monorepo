"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const ProductosMasVendidos = () => {
  // Data de ejemplo
  const data = [
    { producto: 'Laptop HP Pavilion', ventas: 85, ingresos: 68000 },
    { producto: 'Mouse Logitech MX', ventas: 142, ingresos: 28400 },
    { producto: 'Teclado Mecánico', ventas: 67, ingresos: 20100 },
    { producto: 'Monitor LG 27"', ventas: 54, ingresos: 43200 },
    { producto: 'Auriculares Sony', ventas: 98, ingresos: 29400 },
    { producto: 'Webcam HD', ventas: 76, ingresos: 15200 },
    { producto: 'SSD 1TB Samsung', ventas: 45, ingresos: 18000 },
    { producto: 'Impresora Epson', ventas: 32, ingresos: 19200 },
  ].sort((a, b) => b.ventas - a.ventas);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Productos Más Vendidos</h2>

      {/* Top 3 */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '30px' }}>
        {data.slice(0, 3).map((item, index) => (
          <div key={index} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: COLORS[index] }}>
              #{index + 1}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '5px' }}>
              {item.producto}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {item.ventas} unidades
            </div>
            <div style={{ fontSize: '12px', color: '#00C49F', fontWeight: 'bold' }}>
              S/ {item.ingresos.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico de barras */}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="producto" type="category" style={{ fontSize: '12px' }} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'ventas') return [value + ' unidades', 'Ventas'];
              if (name === 'ingresos') return ['S/ ' + value.toLocaleString(), 'Ingresos'];
              return [value, name];
            }}
          />
          <Legend />
          <Bar dataKey="ventas" name="Ventas" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProductosMasVendidos;
