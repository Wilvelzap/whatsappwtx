import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateAIReport = async (apiKey, kpis, insights) => {
    if (!apiKey) throw new Error("API Key is missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
    Act as a Senior Business Analyst for a company using WhatsApp for sales.
    Analyze the following KPI data and provide a strategic report.
    
    DATA:
    - Total Leads: ${kpis.totalLeads}
    - Total Messages: ${kpis.totalMsgs}
    - Leads Captured (Interest): ${kpis.leadsCaptured}
    - Ghosting Rate (Lost at Closing): ${kpis.ghostingRate}%
    - High Value Leads (Score > 35): ${kpis.highValueCount}
    - Response Speed Critical (> 4h): ${kpis.responseDistribution.find(d => d.label.includes('> 4')).count}
    - Night Queries (8PM-7AM): ${kpis.nightQueries}
    
    CURRENT INSIGHTS DETECTED:
    ${insights.map(i => `- ${i.title}: ${i.issue}`).join('\n')}
    
    OUTPUT FORMAT (Markdown):
    ## 1. Diagnóstico Ejecutivo
    [Brief summary of the current situation, tone: professional and direct]
    
    ## 2. Oportunidades de Ingresos (Proyección)
    [Calculate potential lost revenue based on Ghosting Rate and High Value Leads. Assume High Value Lead = $500 USD avg value.]
    
    ## 3. Acciones Inmediatas (Prioridad Alta)
    - [Action 1]
    - [Action 2]
    - [Action 3]
    
    ## 4. Estrategia de Contenido & Scripts
    [Suggest 1 specific WhatsApp script to recover 'Ghosted' leads based on the data]
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating AI report:", error);
        throw new Error("Failed to generate AI report. Check API Key or Quota.");
    }
};
