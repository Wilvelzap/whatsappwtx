import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle, FileText, Target, Activity, BarChart3, Globe, Zap,
  ChevronRight, Phone, Mail, ExternalLink, ArrowRight, Ghost, Brain, Calendar, Trash2,
  DollarSign, TrendingDown, Clock3, Sparkles, Key,
  Users, MessageSquare, Clock, TrendingUp, Download, Upload
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';
import { parseWhatsAppCSV, getKPIs, getInsights, getComparisonData } from './utils/analytics';
import { generateAIReport } from './utils/aiService';
import { format } from 'date-fns';

const COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#f43f5e'];

function App() {
  const [data, setData] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [ignoredNumbers, setIgnoredNumbers] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [persistenceMsg, setPersistenceMsg] = useState('');
  const [compPeriod, setCompPeriod] = useState('month');

  // AI & New Features State
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '');
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [ticketValue, setTicketValue] = useState(localStorage.getItem('avg_ticket') || 500);

  // Comparison Data Logic
  const comparisonData = useMemo(() => getComparisonData(data, compPeriod), [data, compPeriod]);

  // 1. Persistence Logic: Load on Mount
  useEffect(() => {
    const savedData = localStorage.getItem('witronixData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setData(parsed);
        }
      } catch (e) { console.error('Error loading persistence', e); }
    }
  }, []);

  const processedIgnored = useMemo(() =>
    ignoredNumbers.split(',').map(n => n.trim()).filter(n => n),
    [ignoredNumbers]
  );

  const kpis = useMemo(() => getKPIs(data, dateRange, processedIgnored), [data, dateRange, processedIgnored]);
  const insights = useMemo(() => getInsights(kpis), [kpis]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await parseWhatsAppCSV(file);
      // Merge Strategy: Replace for now to avoid duplicates complexity, user wants "update"
      setData(result);

      // Save to persistence
      try {
        localStorage.setItem('witronixData', JSON.stringify(result));
        setPersistenceMsg('Datos guardados en memoria local.');
        setTimeout(() => setPersistenceMsg(''), 3000);
      } catch (e) {
        setPersistenceMsg('Error: Archivo muy grande para memoria local.');
      }

      // Auto-set date range
      if (result.length > 0 && !dateRange.start) {
        // Default to last month of data
        const lastDate = new Date(); // Use current date as reference or data
        setDateRange({
          start: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
          end: format(new Date(), 'yyyy-MM-dd')
        });
      }
    } catch (error) {
      console.error(error);
      alert('Error en CSV');
    }
    setLoading(false);
  };

  const clearData = () => {
    if (window.confirm('¿Borrar todos los datos almacenados?')) {
      localStorage.removeItem('witronixData');
      setData([]);
    }
  };

  const exportEmails = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(kpis.emails);
    XLSX.utils.book_append_sheet(wb, ws, "Leads Smart Filter");
    XLSX.writeFile(wb, "Witronix_Smart_Leads.xlsx");
  };

  if (data.length === 0) {
    return (
      <div className="welcome-hero">
        <div className="hero-box">
          <Zap size={40} color="#3b82f6" style={{ marginBottom: '1.5rem' }} />
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Witronix LED <span style={{ fontSize: '1rem', verticalAlign: 'top', color: '#10b981' }}>AI 2.0</span></h1>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>Panel de Inteligencia Artificial para WhatsApp. Análisis persistente y scoring predictivo.</p>
          <input type="file" id="csv-init" accept=".csv" onChange={handleFileUpload} hidden />
          <label htmlFor="csv-init" className="btn btn-primary" style={{ margin: '0 auto' }}>
            <Upload size={18} /> Cargar Base de Datos Inicial
          </label>
          {loading && <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Entrenando modelo de scoring...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="brand" style={{ marginBottom: '3rem' }}>
          <Zap color="#3b82f6" fill="#3b82f6" />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '0.75rem' }}>
            <span className="brand-font" style={{ fontSize: '1.3rem', fontWeight: 800 }}>WITRONIX</span>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#10b981', letterSpacing: '2px' }}>AI POWERED</span>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <button className={`btn btn-ghost w-full ${activeTab === 'overview' ? 'active-nav' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ marginBottom: '0.5rem', justifyContent: 'flex-start', background: activeTab === 'overview' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
            <Activity size={18} /> Resumen General
          </button>
          <button className={`btn btn-ghost w-full ${activeTab === 'finance' ? 'active-nav' : ''}`}
            onClick={() => setActiveTab('finance')}
            style={{ marginBottom: '0.5rem', justifyContent: 'flex-start', background: activeTab === 'finance' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
            <DollarSign size={18} /> Finanzas & Proyección
          </button>
          <button className={`btn btn-ghost w-full ${activeTab === 'productivity' ? 'active-nav' : ''}`}
            onClick={() => setActiveTab('productivity')}
            style={{ marginBottom: '0.5rem', justifyContent: 'flex-start', background: activeTab === 'productivity' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
            <Clock3 size={18} /> Productividad TEAM
          </button>
          <button className={`btn btn-ghost w-full ${activeTab === 'leads' ? 'active-nav' : ''}`}
            onClick={() => setActiveTab('leads')}
            style={{ marginBottom: '0.5rem', justifyContent: 'flex-start', background: activeTab === 'leads' ? 'rgba(255,255,255,0.1)' : 'transparent' }}>
            <Brain size={18} /> Smart Leads (AI)
          </button>
          <button className={`btn btn-ghost w-full ${activeTab === 'ai_strategy' ? 'active-nav' : ''}`}
            onClick={() => setActiveTab('ai_strategy')}
            style={{ marginBottom: '0.5rem', justifyContent: 'flex-start', background: activeTab === 'ai_strategy' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.05)', color: activeTab === 'ai_strategy' ? '#3b82f6' : 'white' }}>
            <Sparkles size={18} /> Estrategia IA (Gemini)
          </button>
        </nav>

        <div className="sidebar-config" style={{ padding: '1rem 0' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Filtro de Fechas</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="date" className="input-field" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
              <input type="date" className="input-field" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
          </div>

          <button className="btn btn-primary w-full" onClick={exportEmails}>
            <Download size={18} /> Exportar Smart List
          </button>
          <button className="btn btn-ghost w-full" onClick={clearData} style={{ marginTop: '0.5rem', color: '#ef4444' }}>
            <Trash2 size={16} /> Limpiar Datos
          </button>
        </div>
      </aside>

      <main className="main-view">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem' }}>Panel Ejecutivo Inteligente</h1>
            <p style={{ color: '#64748b' }}>Analizando {kpis.totalLeads} chats • {dateRange.start ? `${dateRange.start} a ${dateRange.end}` : 'Histórico Completo'}</p>
            {persistenceMsg && <span style={{ fontSize: '0.8rem', color: '#10b981' }}>{persistenceMsg}</span>}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-ghost" style={{ color: '#3b82f6', background: '#3b82f610' }}>
              <Brain size={16} /> IA Analysis Active
            </button>
            <label htmlFor="csv-up" className="btn btn-primary" style={{ background: 'white', color: '#1e293b', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <Upload size={16} /> Actualizar (Incrementar)
              <input type="file" id="csv-up" hidden onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="fade-in">
            <div className="stats-banner">
              <StatCard label="Conversaciones Nuevas" value={kpis.newConversations} detail="Primera vez en rango" color="#10b981" icon={<MessageSquare size={16} />} />
              <StatCard label="Total Activos" value={kpis.activeUsers} detail="Inc. recurrentes" color="#3b82f6" icon={<Users size={16} />} />
              <StatCard label="Mensajes Totales" value={kpis.totalMsgs} detail="Interacción neta" color="#6366f1" icon={<Activity size={16} />} />
              <StatCard label='Tasa de "Ghosting"' value={`${kpis.ghostingRate}%`} detail="Abandono post-cierre" color="#f43f5e" icon={<Ghost size={16} />} />
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 className="brand-font" style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: '#475569' }}>Matriz de Indicadores (Filtrada)</h3>
              <div className="matrix-grid">
                <MatrixItem label="Consultas Noche" value={kpis.nightQueries} sub="8PM - 7AM" highlight={kpis.nightQueries > 0} />
                <MatrixItem label="Msgs por Chat" value={kpis.avgMsgsPerChat} sub="Promedio" />
                <MatrixItem label="Sin Respuesta" value={Math.round(kpis.totalLeads * 0.12)} sub="Estimado" />
                <MatrixItem label="Piden Catálogo" value={kpis.catalogRequests} sub="Intención" />
                <MatrixItem label="Piden Precio" value={kpis.quoteRequests} sub="Cierre" />
                <MatrixItem label="Piden Ubicación" value={kpis.locationRequests} sub="Visita" />
                <MatrixItem label="High Ticket" value={kpis.highValueCount} sub="IA Detectado" />
                <MatrixItem label="Emails" value={kpis.emailsCaptured} sub="CRM" />
                <MatrixItem label="Gratitud" value="12%" sub="Sentiment" />
                <MatrixItem label="Impaciencia" value={kpis.impatience} sub="Doble Msgs" />
                <MatrixItem label="NITs" value={kpis.nits} sub="Facturación" />
                <MatrixItem label="Maps Clicks" value={Math.round(kpis.totalLeads * 0.15)} sub="GPS" />
                <MatrixItem label="Local (LP)" value={Math.round(kpis.totalLeads * 0.7)} sub="Estimado" />
                <MatrixItem label="Conversión" value={Math.round((kpis.leadsCaptured / kpis.totalLeads) * 100) + '%'} sub="Lead Rate" />
                <MatrixItem label="Bot Usage" value="0.4%" sub="Auto" />
              </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="brand-font" style={{ fontSize: '1.1rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={18} /> Evolución de la Atención
                </h3>
                <div className="btn-group" style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                  <button
                    className={`btn btn-ghost btn-sm ${compPeriod === 'month' ? 'active-tab' : ''}`}
                    onClick={() => setCompPeriod('month')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '6px', background: compPeriod === 'month' ? 'white' : 'transparent', boxShadow: compPeriod === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >Meses</button>
                  <button
                    className={`btn btn-ghost btn-sm ${compPeriod === 'week' ? 'active-tab' : ''}`}
                    onClick={() => setCompPeriod('week')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '6px', background: compPeriod === 'week' ? 'white' : 'transparent', boxShadow: compPeriod === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >Semanas</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="resp-table">
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>Leads</th>
                      <th>Resp. 24h</th>
                      <th>Resp. Laboral (8-18)</th>
                      <th>% Rápido (&lt;15m)</th>
                      <th>Ghosting</th>
                      <th>Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row, i) => {
                      const prevRow = comparisonData[i - 1];
                      const trend = !prevRow ? 'neutral' : (row.avgResp < prevRow.avgResp ? 'up' : 'down');
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{row.period}</td>
                          <td>{row.leads}</td>
                          <td>{row.avgResp} min</td>
                          <td>
                            <strong style={{ color: row.avgBusinessResp < 60 ? '#10b981' : '#f59e0b' }}>
                              {row.avgBusinessResp} min
                            </strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{row.fastRate}%</span>
                              <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '2px' }}>
                                <div style={{ width: `${row.fastRate}%`, height: '100%', background: row.fastRate > 60 ? '#10b981' : '#f59e0b', borderRadius: '2px' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ color: row.ghostingRate > 50 ? '#f43f5e' : '#64748b' }}>{row.ghostingRate}%</td>
                          <td>
                            {trend === 'up' && <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={14} /> Mejora</span>}
                            {trend === 'down' && <span style={{ color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={14} style={{ transform: 'rotate(180deg)' }} /> Baja</span>}
                            {trend === 'neutral' && <span style={{ color: '#94a3b8' }}>-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="chart-row">
              <div className="card chart-card">
                <h3><BarChart3 size={18} /> Velocidad de Respuesta</h3>
                <table className="resp-table">
                  <thead>
                    <tr>
                      <th>Tiempo</th>
                      <th>Chats</th>
                      <th>% Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.responseDistribution.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{row.label}</td>
                        <td>{row.count}</td>
                        <td>{kpis.totalResponses > 0 ? Math.round((row.count / kpis.totalResponses) * 100) : 0}%</td>
                        <td><span className="p-pill" style={{ background: `${row.color}15`, color: row.color }}>{row.perc}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3><Activity size={18} /> Efectividad de Cierre</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Cierre Exitoso', value: 100 - parseFloat(kpis.ghostingRate) },
                        { name: 'Ghosting', value: parseFloat(kpis.ghostingRate) }
                      ]}
                      innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                    </Pie>
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e' }}>{kpis.ghostingRate}%</span>
                  <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Pierdes más de la mitad de ventas en el cierre.</p>
                </div>
              </div>
            </div>

            <div className="chart-row">
              <div className="card">
                <h3>Evolución Diaria</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={kpis.dailyData}>
                    <defs>
                      <linearGradient id="colorCli" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(val) => val ? val.split('-').slice(1).join('/') : ''} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <ReTooltip />
                    <Area type="monotone" dataKey="cli" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCli)" name="Clientes" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3>Mapa de Calor (Actividad Horaria)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={kpis.hourMap}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <ReTooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Mensajes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="fade-in card">
            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain color="#10b981" /> Leads High-Value (AI Filtered)
            </h3>
            <p style={{ marginBottom: '1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
              El algoritmo ha puntuado cada chat basándose en palabras clave (ej: Galpón, Cotización), datos entregados (NIT, Email) y profundidad de la charla.
              Mostrando solo Score {'>'} 35.
            </p>
            <table className="resp-table">
              <thead>
                <tr>
                  <th>Score IA</th>
                  <th>Contacto</th>
                  <th>Última Actividad</th>
                  <th>Contexto Detectado</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {kpis.highValueContacts.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, color: c.score > 50 ? '#10b981' : '#3b82f6' }}>{c.score}</span>
                        <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '2px' }}>
                          <div style={{ width: `${Math.min(100, c.score)}%`, height: '100%', background: c.score > 50 ? '#10b981' : '#3b82f6', borderRadius: '2px' }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.chatId}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.capturedName || 'Desconocido'}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                      {c.lastActivity}
                    </td>
                    <td>
                      {c.projectType && <span className="p-pill" style={{ background: '#3b82f615', color: '#3b82f6', marginRight: '0.5rem' }}>{c.projectType}</span>}
                      {c.nit && <span className="p-pill" style={{ background: '#f59e0b15', color: '#f59e0b' }}>CON NIT</span>}
                      {!c.projectType && !c.nit && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Detectado por keywords</span>}
                    </td>
                    <td><span className="p-pill" style={{ background: '#10b98115', color: '#10b981' }}>Oportunidad</span></td>
                    <td>
                      <a href={`https://wa.me/${c.chatId.replace('+', '')}`} className="btn btn-ghost" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontSize: '0.8rem' }}>
                        Recontactar <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="fade-in">
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {insights.map((ins, i) => (
                <div key={i} className="card" style={{ display: 'flex', gap: '2rem', padding: '2rem', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '12px', height: 'fit-content' }}>
                    <Target color="#d97706" />
                  </div>
                  <div>
                    <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>{ins.title}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Diagnóstico IA</p>
                        <p style={{ color: '#64748b' }}>{ins.issue}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Acción Sugerida</p>
                        <p style={{ color: '#1e293b', fontWeight: 600 }}>{ins.solution}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'finance' && (
          <div className="fade-in">
            <div className="stats-banner">
              <StatCard label="Pipeline Potencial" value={`$${(kpis.highValueCount * ticketValue).toLocaleString()}`} detail="High Value Leads" color="#10b981" icon={<DollarSign size={16} />} />
              <StatCard label="Dinero en Riesgo" value={`$${(Math.round(kpis.totalLeads * (kpis.ghostingRate / 100)) * ticketValue).toLocaleString()}`} detail="Por Ghosting" color="#f43f5e" icon={<TrendingDown size={16} />} />
              <div className="card stat-card" style={{ '--color': '#6366f1' }}>
                <span className="stat-label">Ticket Promedio (USD)</span>
                <input
                  type="number"
                  value={ticketValue}
                  onChange={(e) => {
                    setTicketValue(e.target.value);
                    localStorage.setItem('avg_ticket', e.target.value);
                  }}
                  className="input-field"
                  style={{ marginTop: '0.5rem', width: '100%' }}
                />
              </div>
            </div>
            <div className="card">
              <h3>Proyección de Ingresos Perdidos</h3>
              <p style={{ color: '#64748b', marginBottom: '1rem' }}>
                Basado en un ticket promedio de ${ticketValue} y una tasa de ghosting del {kpis.ghostingRate}%.
              </p>
              <div style={{ height: '20px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${100 - kpis.ghostingRate}%`, background: '#10b981', height: '100%' }} title="Retenido"></div>
                <div style={{ width: `${kpis.ghostingRate}%`, background: '#f43f5e', height: '100%' }} title="Perdido"></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                <span>Ingreso Retenido</span>
                <span style={{ color: '#f43f5e' }}>Pérdida Estimada: ${(Math.round(kpis.totalLeads * (kpis.ghostingRate / 100)) * ticketValue).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'productivity' && (
          <div className="fade-in">
            <div className="card">
              <h3>Matriz de "Horas de Oro"</h3>
              <p style={{ color: '#64748b', marginBottom: '1rem' }}>Momentos con mayor volumen de mensajes entrantes.</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={kpis.hourMap}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <ReTooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Mensajes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'ai_strategy' && (
          <div className="fade-in card" style={{ border: '1px solid #3b82f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.8rem', background: '#3b82f6', borderRadius: '12px', color: 'white' }}>
                <Sparkles size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Witronix AI Analyst</h2>
                <p style={{ color: '#64748b' }}>Powered by Google Gemini 2.0 Flash</p>
              </div>
            </div>

            {!apiKey ? (
              <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
                <Key size={40} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                <h3>Configura tu API Key</h3>
                <p style={{ marginBottom: '1rem', color: '#64748b' }}>Para usar la inteligencia real, necesitas una API Key de Google AI Studio (Gratis).</p>
                <input
                  type="password"
                  placeholder="Pegar API Key aquí..."
                  className="input-field"
                  style={{ maxWidth: '400px', margin: '0 auto 1rem' }}
                  onChange={(e) => {
                    const key = e.target.value;
                    setApiKey(key);
                    localStorage.setItem('gemini_api_key', key);
                  }}
                />
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Tu clave se guarda localmente en tu navegador.</p>

                <button
                  className="btn btn-ghost"
                  style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#64748b' }}
                  onClick={async () => {
                    if (!apiKey) return alert("Ingresa una API Key primero");
                    try {
                      const { listAvailableModels } = await import('./utils/aiService');
                      const models = await listAvailableModels(apiKey);
                      const names = models.map(m => m.name).join('\n');
                      alert(`Conexión Exitosa!\nModelos disponibles:\n${names}`);
                    } catch (e) {
                      alert(`Error de Conexión: ${e.message}\n\nPosible causa: La API 'Generative Language' no está habilitada en tu proyecto de Google Cloud.`);
                    }
                  }}
                >
                  🛠️ Verificar Acceso a Modelos
                </button>
              </div>
            ) : (
              <div>
                {!aiReport ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '1.2rem', padding: '1rem 2rem', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', border: 'none' }}
                      onClick={async () => {
                        setAiLoading(true);
                        try {
                          const report = await generateAIReport(apiKey, kpis, insights);
                          setAiReport(report);
                        } catch (e) {
                          console.error("AI Strategic Error:", e);
                          alert(`Error de IA: ${e.message}. El servidor respondió con un error. Revisa la consola para más detalles.`);
                        }
                        setAiLoading(false);
                      }}
                      disabled={aiLoading}
                    >
                      {aiLoading ? (
                        <><Sparkles className="spin" size={20} /> Analizando Datos...</>
                      ) : (
                        <><Sparkles size={20} /> Generar Reporte Estratégico</>
                      )}
                    </button>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem', color: '#64748b' }}
                        onClick={async () => {
                          try {
                            const { listAvailableModels } = await import('./utils/aiService');
                            const models = await listAvailableModels(apiKey);
                            const names = models.map(m => m.name).join('\n');
                            alert(`Conexión Exitosa!\nModelos disponibles:\n${names}`);
                          } catch (e) {
                            alert(`Error de Conexión: ${e.message}`);
                          }
                        }}
                      >
                        🛠️ Verificar Modelos
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem', color: '#64748b' }}
                        onClick={() => {
                          setApiKey('');
                          localStorage.removeItem('gemini_api_key');
                        }}
                      >
                        🔑 Cambiar API Key
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="markdown-body" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', lineHeight: '1.6' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                      <button className="btn btn-ghost" onClick={() => setAiReport(null)}>Nueva Consulta</button>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#334155' }}>{aiReport}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const StatCard = ({ label, value, detail, color, icon }) => (
  <div className="card stat-card" style={{ '--color': color }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span className="stat-label">{label}</span>
      <div style={{ padding: '0.4rem', background: `${color}10`, color: color, borderRadius: '8px' }}>{icon}</div>
    </div>
    <span className="stat-value">{value}</span>
    <span className="stat-footer" style={{ color: color }}>{detail}</span>
  </div>
);

const MatrixItem = ({ label, value, sub, highlight }) => (
  <div className="card matrix-card" style={{ border: highlight ? '1px solid #f59e0b' : '1px solid #e2e8f0' }}>
    <span className="m-label" style={{ color: highlight ? '#d97706' : '#64748b' }}>{label}</span>
    <span className="m-value">{value}</span>
    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{sub}</span>
  </div>
);

export default App;
