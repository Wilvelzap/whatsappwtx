import Papa from 'papaparse';
import { parse, format, differenceInMinutes, startOfDay, isBefore, isAfter, isEqual, isWeekend, addDays, setHours, setMinutes } from 'date-fns';

// Helper for robust date parsing to fix "Night Queries" and general date issues
const parseDate = (dateStr) => {
    if (!dateStr) return null;
    // Common formats in WhatsApp exports: 
    // 1. MM/dd/yyyy HH:mm:ss
    // 2. dd/MM/yyyy HH:mm
    // 3. yyyy-MM-dd HH:mm:ss

    // Try standard parse first
    try {
        // Attempt to parse commonly used formats
        // format 'MM-dd-yyyy HH:mm:ss' seems to be the one used in previous code
        let d = parse(dateStr, 'MM-dd-yyyy HH:mm:ss', new Date());
        if (!isNaN(d)) return d;

        // Try standard JS Date constructor as backup
        d = new Date(dateStr);
        if (!isNaN(d)) return d;

        // Last resort for some Excel CSVs: 'dd/MM/yy HH:mm'
        d = parse(dateStr, 'dd/MM/yy HH:mm', new Date());
        if (!isNaN(d)) return d;

    } catch (e) { }

    return null;
};

// BUSINESS HOURS CALCULATOR (Mon-Fri, 8:00 - 18:00)
const calculateBusinessMinutes = (start, end) => {
    if (!start || !end || isAfter(start, end)) return 0;

    let totalMinutes = 0;
    let current = new Date(start);
    const final = new Date(end);

    while (isBefore(current, final)) {
        // If current is weekend, skip to Monday 8:00
        if (isWeekend(current)) {
            current = addDays(current, 1);
            current = setHours(setMinutes(current, 0), 8); // Reset to start of day
            continue;
        }

        // Define Work day for CURRENT date
        const workStart = setHours(setMinutes(new Date(current), 0), 8);
        const workEnd = setHours(setMinutes(new Date(current), 0), 18);

        // If current is after workEnd, skip to next day 8:00
        if (isAfter(current, workEnd)) {
            current = addDays(current, 1);
            current = setHours(setMinutes(current, 0), 8);
            continue;
        }

        // Assume we can count some minutes today
        // Effective start for today is Max(current, workStart)
        const effectiveStart = isAfter(current, workStart) ? current : workStart;

        // Effective end for today is Min(final, workEnd)
        // Check if final is on the same day?
        let effectiveEnd = workEnd;
        if (isBefore(final, workEnd) && isEqual(startOfDay(final), startOfDay(current))) {
            effectiveEnd = final;
        }

        // If effectiveStart < effectiveEnd, add diff
        if (isBefore(effectiveStart, effectiveEnd)) {
            totalMinutes += differenceInMinutes(effectiveEnd, effectiveStart);
        }

        // Move current to next day 8:00 if we haven't reached final
        // Optimization: If final is same day, loop breaks naturally? 
        // We need to advance 'current' to avoid infinite loop
        if (isEqual(startOfDay(final), startOfDay(current))) {
            break; // Done for the last day
        } else {
            current = addDays(current, 1);
            current = setHours(setMinutes(current, 0), 8);
        }
    }

    return Math.max(0, totalMinutes);
};

export const parseWhatsAppCSV = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                resolve(processData(results.data));
            },
            error: (error) => {
                reject(error);
            },
        });
    });
};

// "AI" Simulation: Weighted Scoring System
const calculateLeadScore = (messages, meta) => {
    let score = 0;
    const contentStr = messages.map(m => m.content.toLowerCase()).join(' ');

    // 1. Explicit Intent (Keywords)
    if (contentStr.includes('cotización') || contentStr.includes('precio') || contentStr.includes('costo')) score += 15;
    if (contentStr.includes('catálogo') || contentStr.includes('catalogo')) score += 10;
    if (contentStr.includes('ubicación') || contentStr.includes('dirección')) score += 8;

    // 2. High Value Context (Industry Terms) - Weighted higher
    if (contentStr.includes('galpón') || contentStr.includes('nave industrial')) score += 25;
    if (contentStr.includes('edificio') || contentStr.includes('condominio')) score += 20;
    if (contentStr.includes('arquitecto') || contentStr.includes('constructora')) score += 20;
    if (contentStr.includes('por mayor') || contentStr.includes('mayorista')) score += 15;
    if (contentStr.includes('proyecto')) score += 10;
    if (contentStr.includes('clínica') || contentStr.includes('hospital')) score += 20;

    // 3. Information Exchange
    if (meta.email) score += 20;
    if (meta.nit) score += 15;
    if (meta.capturedName) score += 10;

    // 4. Engagement Depth
    if (messages.length > 5) score += 5;
    if (messages.length > 10) score += 5;

    // 5. Negative factors (Low quality filter)
    // Very short interaction with no key terms
    if (messages.length < 3 && score < 10) score -= 10;

    return score;
};

const processData = (data) => {
    const cleanData = data.map(row => ({
        chatId: (row.Chats || '').trim().replace(/"/g, ''),
        type: (row.Type || '').trim(),
        date: (row.Date || '').trim(),
        name: (row.Name || '').trim(),
        content: (row.Content || '').trim()
    })).filter(row => row.chatId && row.date);

    const chatsMap = {};
    cleanData.forEach(row => {
        if (!chatsMap[row.chatId]) {
            chatsMap[row.chatId] = [];
        }
        chatsMap[row.chatId].push(row);
    });

    const processedChats = Object.keys(chatsMap).map(id => {
        const messages = chatsMap[id].sort((a, b) => {
            const d1 = parseDate(a.date) || 0;
            const d2 = parseDate(b.date) || 0;
            return d1 - d2;
        });

        const leadInfo = extractLeadInfo(messages);
        const responseMetrics = calculateResponseMetrics(messages);
        const funnelStep = detectFunnelStep(messages);
        const hasFollowUp = detectFollowUp(messages);
        const replyStyle = detectReplyStyle(messages);
        const score = calculateLeadScore(messages, leadInfo);

        return {
            chatId: id,
            messages,
            ...leadInfo,
            ...responseMetrics,
            funnelStep,
            hasFollowUp,
            replyStyle,
            score,
            // Smart Filter: Only High Value if score > 35
            isHighValue: score >= 35
        };
    });

    return processedChats;
};

const extractLeadInfo = (messages) => {
    let email = null;
    let nit = null;
    let name = null;
    let projectType = null;
    let products = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    const PRODUCT_KEYWORDS = {
        'Paneles LED': ['panel', 'paneles'],
        'Triproof': ['triproof', 'hermetica', 'hermética'],
        'Campanas UFO': ['campana', 'ufo', 'industrial'],
        'Focos': ['foco', 'bulbo'],
        'Tubos': ['tubo'],
        'Cintas LED': ['cinta', 'tira']
    };

    messages.forEach(m => {
        const content = m.content;
        const foundEmail = content.match(emailRegex);
        if (foundEmail && !foundEmail[0].includes('w.app')) email = foundEmail[0];

        const lower = content.toLowerCase();

        // Product detection
        Object.keys(PRODUCT_KEYWORDS).forEach(prodName => {
            if (PRODUCT_KEYWORDS[prodName].some(kw => lower.includes(kw)) && !products.includes(prodName)) {
                products.push(prodName);
            }
        });

        // Robust extraction with regex split
        if (lower.includes('nombre:')) {
            const parts = content.split(/nombre:/i);
            if (parts[1]) name = parts[1].split(/[\n,]/)[0].trim();
        }

        if (lower.includes('nit:') || lower.includes('ci:')) {
            const parts = content.split(/(nit|ci):/i);
            const val = parts[parts.length - 1];
            if (val) nit = val.split(/[\n,]/)[0].trim().replace(/[^0-9]/g, '');
        }

        if (lower.includes('proyecto:')) {
            const parts = content.split(/proyecto:/i);
            if (parts[1]) projectType = parts[1].split(/[\n,]/)[0].trim();
        }
    });

    return { email, nit, capturedName: name, projectType, products };
};

const calculateResponseMetrics = (messages) => {
    let totalResponseTime = 0;
    let totalBusinessResponseTime = 0;
    let responseCount = 0;
    const responseTimes = [];

    for (let i = 0; i < messages.length - 1; i++) {
        const current = messages[i];
        const next = messages[i + 1];

        if (current.type === 'Received' && next.type === 'Sended') {
            const start = parseDate(current.date);
            const end = parseDate(next.date);

            if (start && end) {
                const diff = Math.max(0, differenceInMinutes(end, start));
                // Filter huge gaps (e.g., > 3 days) to avoid skewing data
                if (diff < 4320) {
                    totalResponseTime += diff;
                    totalBusinessResponseTime += calculateBusinessMinutes(start, end);
                    responseCount++;
                    responseTimes.push(diff);
                }
            }
        }
    }

    return {
        avgResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
        avgBusinessResponseTime: responseCount > 0 ? Math.round(totalBusinessResponseTime / responseCount) : 0,
        responseTimes,
        totalInteractions: messages.length,
        lastActivity: messages.length > 0 ? messages[messages.length - 1].date : null
    };
};

const detectFunnelStep = (messages) => {
    const sendedStr = messages.filter(m => m.type === 'Sended').map(m => m.content.toLowerCase()).join(' ');
    
    // Funnel stages (from highest to lowest priority)
    if (sendedStr.includes('qr') || sendedStr.includes('transferencia') || sendedStr.includes('cuenta bancaria')) return 'Payment/QR Sent';
    if (sendedStr.includes('.pdf') || sendedStr.includes('cotización enviada')) return 'Quote Sent';
    if (sendedStr.includes('bs') || sendedStr.includes('$') || sendedStr.includes('bolivianos')) return 'Price Given';
    if (sendedStr.includes('@') || messages.some(m => m.content.toLowerCase().includes('nit:'))) return 'Lead Captured';
    if (messages.some(m => m.type === 'Sended')) return 'Engaged';
    return 'Inquiry';
};

const detectFollowUp = (messages) => {
    let hasFollowUp = false;
    for (let i = 0; i < messages.length - 1; i++) {
        if (messages[i].type === 'Sended' && messages[i+1].type === 'Sended') {
            const d1 = parseDate(messages[i].date);
            const d2 = parseDate(messages[i+1].date);
            if (d1 && d2 && differenceInMinutes(d2, d1) > 60) {
                hasFollowUp = true;
                break;
            }
        }
    }
    return hasFollowUp;
};

const detectReplyStyle = (messages) => {
    const firstWitronixMsg = messages.find(m => m.type === 'Sended');
    if (!firstWitronixMsg) return 'Sin Respuesta';
    
    const lower = firstWitronixMsg.content.toLowerCase();
    if (lower.includes('?') || lower.includes('iluminar') || lower.includes('proyecto') || lower.includes('buscaba')) return 'Pregunta Consultiva';
    if (lower.includes('bs') || lower.includes('usd') || lower.includes('$')) return 'Cotización Directa';
    if (lower.includes('nit') || lower.includes('factura')) return 'Solicita Datos';
    return 'Saludo de Marca';
};

// Main Export
export const getKPIs = (chats, dateRange = null, ignoredNumbers = []) => {
    const filteredChats = chats.filter(chat => {
        if (ignoredNumbers.includes(chat.chatId)) return false;

        // Date Range Filter logic
        if (dateRange && dateRange.start && dateRange.end) {
            const lastMsgDate = parseDate(chat.lastActivity);
            if (!lastMsgDate) return false;

            // Normalize to Start of Day for comparison
            const start = startOfDay(new Date(dateRange.start));
            const end = startOfDay(new Date(dateRange.end));
            end.setHours(23, 59, 59); // Include the entire end day

            const checkDate = new Date(lastMsgDate);
            return (isAfter(checkDate, start) || isEqual(checkDate, start)) &&
                (isBefore(checkDate, end) || isEqual(checkDate, end));
        }
        return true;
        return true;
    });

    // New Metric: "New Conversations" (First contact in range)
    const newConversations = filteredChats.filter(chat => {
        if (!processDateRange || !processDateRange.start) return true; // If no range, all are technically "new" to the view? No, use full history logic or just count all? 
        // Better logic: new conversations are those whose FIRST message is in the range
        // However, 'filteredChats' only contains chats with ACTIVITY in range. 
        // We need to check the very first message of the chat history.
        const firstMsg = chat.messages[0];
        const firstDate = parseDate(firstMsg.date);

        if (!firstDate) return false;

        const start = startOfDay(new Date(processDateRange.start));
        const end = startOfDay(new Date(processDateRange.end));
        end.setHours(23, 59, 59);

        return (isAfter(firstDate, start) || isEqual(firstDate, start)) &&
            (isBefore(firstDate, end) || isEqual(firstDate, end));
    }).length;

    // Helper to capture range for new convo check
    var processDateRange = dateRange;

    const totalLeads = filteredChats.length;
    const leadsCaptured = filteredChats.filter(c => c.funnelStep === 'Lead Captured' || c.funnelStep === 'Quote Sent').length;

    // Ghosting Rate
    const ghostingCount = filteredChats.filter(chat => {
        const lastMsg = chat.messages[chat.messages.length - 1];
        const hasCTA = chat.messages.some(m => m.type === 'Sended' && (m.content.includes('necesito') || m.content.includes('?')));
        return hasCTA && lastMsg.type === 'Sended';
    }).length;

    const hourMap = Array(24).fill(0);
    const dailyEvolution = {};
    const dist = { fast: 0, good: 0, medium: 0, slow: 0, critical: 0 };

    filteredChats.forEach(chat => {
        // Heatmap - Using parseDate to fix "Night Queries"
        chat.messages.forEach(m => {
            const d = parseDate(m.date);
            if (d) {
                if (m.type === 'Received') {
                    hourMap[d.getHours()]++;

                    const dayKey = format(d, 'yyyy-MM-dd');
                    if (!dailyEvolution[dayKey]) dailyEvolution[dayKey] = { date: dayKey, cli: 0, wit: 0 };
                    dailyEvolution[dayKey].cli++;
                } else {
                    const dayKey = format(d, 'yyyy-MM-dd');
                    if (!dailyEvolution[dayKey]) dailyEvolution[dayKey] = { date: dayKey, cli: 0, wit: 0 };
                    dailyEvolution[dayKey].wit++;
                }
            }
        });

        chat.responseTimes.forEach(t => {
            if (t < 5) dist.fast++;
            else if (t < 15) dist.good++;
            else if (t < 60) dist.medium++;
            else if (t < 240) dist.slow++;
            else dist.critical++;
        });
    });

    const dailyData = Object.values(dailyEvolution).sort((a, b) => a.date.localeCompare(b.date));

    // Misc KPIs
    const totalMsgs = filteredChats.reduce((acc, c) => acc + c.messages.length, 0);
    const quoteRequests = filteredChats.reduce((acc, c) => acc + c.messages.filter(m => m.content.toLowerCase().includes('cotización')).length, 0);
    const locationRequests = filteredChats.reduce((acc, c) => acc + c.messages.filter(m => m.content.toLowerCase().includes('ubicación') || m.content.toLowerCase().includes('dirección')).length, 0);
    const catalogRequests = filteredChats.reduce((acc, c) => acc + c.messages.filter(m => m.content.toLowerCase().includes('catálogo')).length, 0);

    const impatience = filteredChats.reduce((acc, c) => {
        let count = 0;
        for (let i = 1; i < c.messages.length; i++) {
            if (c.messages[i].type === 'Received' && c.messages[i - 1].type === 'Received') count++;
        }
        return acc + count;
    }, 0);

    // Night Queries (8PM - 7AM) - Fixed logic
    const nightQueries = filteredChats.reduce((acc, c) => {
        return acc + c.messages.filter(m => {
            const d = parseDate(m.date);
            if (!d || m.type !== 'Received') return false;
            const h = d.getHours();
            return h >= 20 || h < 7;
        }).length;
    }, 0);

    // Depth Distribution
    const depthDistribution = { '1-2 msgs': 0, '3-5 msgs': 0, '6-10 msgs': 0, '11+ msgs': 0 };
    filteredChats.forEach(c => {
        const count = c.messages.length;
        if (count <= 2) depthDistribution['1-2 msgs']++;
        else if (count <= 5) depthDistribution['3-5 msgs']++;
        else if (count <= 10) depthDistribution['6-10 msgs']++;
        else depthDistribution['11+ msgs']++;
    });

    // Reply Styles & Products
    const replyStyles = {};
    const productStats = {};
    filteredChats.forEach(c => {
        if (!replyStyles[c.replyStyle]) replyStyles[c.replyStyle] = 0;
        replyStyles[c.replyStyle]++;
        
        if (c.products && c.products.length > 0) {
            c.products.forEach(p => {
                if (!productStats[p]) productStats[p] = 0;
                productStats[p]++;
            });
        }
    });

    // Format products to array sorted
    const topProducts = Object.keys(productStats)
        .map(p => ({ term: p, count: productStats[p] }))
        .sort((a, b) => b.count - a.count);

    return {
        totalLeads,
        totalMsgs,
        leadsCaptured,
        emailsCaptured: filteredChats.filter(c => c.email).length,
        ghostingRate: totalLeads > 0 ? ((ghostingCount / totalLeads) * 100).toFixed(1) : 0,
        avgMsgsPerChat: totalLeads > 0 ? (totalMsgs / totalLeads).toFixed(1) : 0,
        hourMap: hourMap.map((count, hour) => ({ hour: `${hour}:00`, value: count })),
        dailyData,
        responseDistribution: [
            { label: '< 5 Minutos', count: dist.fast, perc: 'Excelente', color: '#10b981' },
            { label: '5 - 15 Minutos', count: dist.good, perc: 'Bueno', color: '#3b82f6' },
            { label: '15 - 60 Minutos', count: dist.medium, perc: 'Regular', color: '#f59e0b' },
            { label: '1 - 4 Horas', count: dist.slow, perc: 'Lento', color: '#6366f1' },
            { label: '> 4 Horas', count: dist.critical, perc: 'Crítico', color: '#ef4444' }
        ],
        totalResponses: dist.fast + dist.good + dist.medium + dist.slow + dist.critical,
        depthDistribution,
        replyStyles,
        topProducts,
        // Funnel & Rates
        quotesSent: filteredChats.filter(c => c.funnelStep === 'Quote Sent' || c.funnelStep === 'Payment/QR Sent').length,
        pricesGiven: filteredChats.filter(c => c.funnelStep === 'Price Given' || c.funnelStep === 'Quote Sent' || c.funnelStep === 'Payment/QR Sent').length,
        followUps: filteredChats.filter(c => c.hasFollowUp).length,
        qrsSent: filteredChats.filter(c => c.funnelStep === 'Payment/QR Sent').length,
        consultativeFirstRate: totalLeads > 0 ? Math.round((replyStyles['Pregunta Consultiva'] || 0) / totalLeads * 100) : 0,
        // SMART SORTED HIGH VALUE
        highValueContacts: filteredChats.filter(c => c.isHighValue).sort((a, b) => b.score - a.score),
        emails: filteredChats.map(c => ({ Nombre: c.capturedName || 'Cliente', Email: c.email, Telefono: c.chatId, Score: c.score })).filter(e => e.Email),

        quoteRequests,
        locationRequests,
        catalogRequests,
        impatience,
        nightQueries,
        activeUsers: filteredChats.length,
        newConversations: dateRange && dateRange.start ? newConversations : filteredChats.length,
        nits: filteredChats.filter(c => c.nit).length,
        // Using filtered count
        highValueCount: filteredChats.filter(c => c.isHighValue).length
    };
};

export const getInsights = (kpis) => {
    const insights = [];

    if (kpis.highValueCount > 0) {
        insights.push({
            title: 'Oportunidades High-Ticket (IA)',
            issue: `La IA ha detectado ${kpis.highValueCount} leads contextuales de alto valor (Industria/Construcción).`,
            solution: 'Revisar la pestaña "Leads de Alto Valor" y priorizar el contacto telefónico. Estos leads tienen un Score > 35.'
        });
    }

    if (parseFloat(kpis.ghostingRate) > 40) {
        insights.push({
            title: 'Fricción en Cierre (Ghosting)',
            issue: `El ${kpis.ghostingRate}% de usuarios abandona.`,
            solution: 'Táctica de Ventas: Enviar el precio base antes de pedir el NIT completo.'
        });
    }

    if (kpis.nightQueries > 0) {
        insights.push({
            title: 'Demanda Nocturna (8PM - 7AM)',
            issue: `Se detectaron ${kpis.nightQueries} mensajes fuera de horario.`,
            solution: 'Automatización: Configurar autorespuesta nocturna con link al catálogo PDF.'
        });
    }

    if (kpis.responseDistribution && kpis.responseDistribution[4].count > kpis.responseDistribution[0].count) {
        insights.push({
            title: 'Cuello de Botella Critico',
            issue: 'Los tiempos de respuesta > 4 horas superan a los inmediatos.',
            solution: 'Urgente: Implementar chatbot de triaje inicial.'
        });
    }

    return insights;
};

export const getComparisonData = (chats, period = 'month') => {
    const groups = {};

    chats.forEach(chat => {
        const date = parseDate(chat.lastActivity);
        if (!date) return;

        let key;
        if (period === 'month') {
            key = format(date, 'yyyy-MM');
        } else {
            // ISO Week
            key = `S${format(date, 'I')}-${format(date, 'yyyy')}`;
        }

        if (!groups[key]) {
            groups[key] = {
                period: key,
                leads: 0,
                totalResponseTime: 0,
                totalBusinessResp: 0,
                responseCount: 0,
                fastResponses: 0,
                ghostingCount: 0,
                engancheCount: 0,
                priceGiven: 0,
                quoteSent: 0,
                qrSent: 0,
                followUps: 0,
                consultative: 0
            };
        }

        groups[key].leads++;
        groups[key].totalResponseTime += chat.avgResponseTime;

        // Funnel & Rates Over Time
        if (chat.funnelStep === 'Engaged' || chat.funnelStep === 'Lead Captured' || chat.funnelStep === 'Quote Sent' || chat.funnelStep === 'Price Given' || chat.funnelStep === 'Payment/QR Sent') groups[key].engancheCount++;
        if (chat.funnelStep === 'Price Given' || chat.funnelStep === 'Quote Sent' || chat.funnelStep === 'Payment/QR Sent') groups[key].priceGiven++;
        if (chat.funnelStep === 'Quote Sent' || chat.funnelStep === 'Payment/QR Sent') groups[key].quoteSent++;
        if (chat.funnelStep === 'Payment/QR Sent') groups[key].qrSent++;
        if (chat.hasFollowUp) groups[key].followUps++;
        if (chat.replyStyle === 'Pregunta Consultiva') groups[key].consultative++;

        // Backward compatibility: If cached data doesn't have the new metric, calculate it now
        let busTime = chat.avgBusinessResponseTime;
        if (busTime === undefined) {
            const metrics = calculateResponseMetrics(chat.messages);
            busTime = metrics.avgBusinessResponseTime;
        }
        groups[key].totalBusinessResp += (busTime || 0);
        if (chat.avgResponseTime > 0) groups[key].responseCount++;

        // Fast responses (< 15 min)
        const chatFast = chat.responseTimes.filter(t => t < 15).length;
        const chatTotal = chat.responseTimes.length;
        if (chatTotal > 0 && (chatFast / chatTotal) > 0.5) groups[key].fastResponses++;

        // Ghosting check
        const lastMsg = chat.messages[chat.messages.length - 1];
        const hasCTA = chat.messages.some(m => m.type === 'Sended' && (m.content.includes('necesito') || m.content.includes('?')));
        if (hasCTA && lastMsg.type === 'Sended') groups[key].ghostingCount++;
    });

    return Object.values(groups)
        .sort((a, b) => a.period.localeCompare(b.period))
        .map(g => ({
            period: g.period,
            leads: g.leads,
            avgResp: g.responseCount > 0 ? Math.round(g.totalResponseTime / g.responseCount) : 0,
            avgBusinessResp: g.responseCount > 0 ? Math.round(g.totalBusinessResp / g.responseCount) : 0,
            fastRate: g.leads > 0 ? Math.round((g.fastResponses / g.leads) * 100) : 0,
            ghostingRate: g.leads > 0 ? Math.round((g.ghostingCount / g.leads) * 100) : 0,
            engancheRate: g.leads > 0 ? Math.round((g.engancheCount / g.leads) * 100) : 0,
            priceRate: g.leads > 0 ? Math.round((g.priceGiven / g.leads) * 100) : 0,
            quoteRate: g.leads > 0 ? Math.round((g.quoteSent / g.leads) * 100) : 0,
            qrRate: g.leads > 0 ? Math.round((g.qrSent / g.leads) * 100) : 0,
            followUpRate: g.leads > 0 ? Math.round((g.followUps / g.leads) * 100) : 0,
            consultativeRate: g.leads > 0 ? Math.round((g.consultative / g.leads) * 100) : 0
        }));
};
