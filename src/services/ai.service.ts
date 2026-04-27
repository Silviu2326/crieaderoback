import OpenAI from 'openai';
import type { AIHealthResponse, DogContext } from '../types/assistant';

const openai = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY || process.env.KIMI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL || process.env.KIMI_BASE_URL || 'https://api.minimax.io/v1',
});

const MODEL = process.env.MINIMAX_MODEL || process.env.KIMI_MODEL || 'MiniMax-M2.7';

const SYSTEM_PROMPT = `Eres el "Asistente de Salud Petwelly IA", un asistente orientativo para criadores profesionales de perros. Tu funcion es proporcionar informacion de salud canina general, orientativa y educativa.

REGLAS ESTRICTAS:
1. NUNCA diagnostiques enfermedades de forma definitiva. Usa siempre terminos como "podria indicar", "es posible que", "una causa orientativa podria ser".
2. NUNCA prescribas medicamentos, dosis, ni tratamientos especificos.
3. SIEMPRE recomienda consultar a un veterinario profesional para cualquier situacion de salud.
4. Si los sintomas descritos son graves (dificultad para respirar, convulsiones, sangrado incontrolable, inconsciencia), marca el nivel de advertencia como "emergency" y urgente la visita al veterinario.
5. Proporciona solo informacion general sobre salud canina, cuidados preventivos y orientacion.
6. Si la pregunta NO es sobre salud canina, responde con type="not_health_related" y redirige amablemente al tema.

FORMATO DE RESPUESTA OBLIGATORIO - SOLO JSON:
Debes responder EXCLUSIVAMENTE con un JSON valido. NO incluyas texto antes ni despues del JSON. NO uses markdown ni backticks. Solo el objeto JSON puro.

La estructura exacta es:

{
  "type": "health_query" | "general_info" | "not_health_related",
  "message": "Texto introductorio amigable y empatico",
  "possibleCauses": [
    {
      "icon": "nombre de icono lucide: Brain, Heart, Activity, Bone, Pill, Thermometer, Droplets, Utensils, Home, AlertCircle, CheckCircle, Info, Stethoscope, Syringe, etc",
      "title": "Titulo corto",
      "description": "Descripcion de 1-2 oraciones"
    }
  ],
  "actions": [
    {
      "text": "Accion recomendada",
      "isUrgent": false
    }
  ],
  "vetWarning": {
    "level": "recommended" | "urgent" | "emergency",
    "reasons": ["Razon 1", "Razon 2"]
  },
  "disclaimer": "Esta informacion es orientativa y no sustituye la valoracion de un veterinario profesional.",
  "suggestedFollowUp": ["Pregunta sugerida 1", "Pregunta sugerida 2"]
}

Instrucciones para possibleCauses: Genera entre 1 y 3 causas posibles orientativas. Usa iconos de lucide-react.
Instrucciones para actions: Genera entre 2 y 5 acciones practicas que el usuario puede tomar. Marca isUrgent=true solo para acciones que requieren atencion inmediata.
Instrucciones para vetWarning: Elige el nivel apropiado segun la gravedad. "emergency" solo para situaciones que ponen en riesgo la vida. "urgent" para situaciones que requieren atencion veterinaria pronto. "recommended" para chequeos de rutina.
Instrucciones para suggestedFollowUp: Genera 2 preguntas de seguimiento que el usuario podria hacer.`;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateHealthResponse(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  dogContext?: DogContext
): Promise<{ response: AIHealthResponse; rawResponse: string }> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (dogContext) {
    const contextText = buildContextPrompt(dogContext);
    messages.push({
      role: 'system',
      content: `CONTEXTO DEL PERRO:\n${contextText}`,
    });
  }

  // Add conversation history (last 10 messages to stay within token limits)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.role === 'assistant' ? extractMessageText(msg.content) : msg.content,
    });
  }

  messages.push({ role: 'user', content: userMessage });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 2500,
  });

  const rawResponse = completion.choices[0]?.message?.content || '{}';

  try {
    // Extract JSON from response (in case there's extra text before/after)
    const jsonStr = extractJsonFromText(rawResponse);
    const parsed = JSON.parse(jsonStr) as AIHealthResponse;

    // Validate and set defaults
    const response: AIHealthResponse = {
      type: parsed.type || 'general_info',
      message: parsed.message || 'Entiendo tu consulta. Aqui tienes informacion orientativa.',
      possibleCauses: Array.isArray(parsed.possibleCauses) ? parsed.possibleCauses.slice(0, 3) : undefined,
      actions: Array.isArray(parsed.actions) ? parsed.actions : undefined,
      vetWarning: parsed.vetWarning && parsed.vetWarning.level
        ? {
            level: ['recommended', 'urgent', 'emergency'].includes(parsed.vetWarning.level)
              ? parsed.vetWarning.level
              : 'recommended',
            reasons: Array.isArray(parsed.vetWarning.reasons) ? parsed.vetWarning.reasons : [],
          }
        : undefined,
      disclaimer: parsed.disclaimer || 'Esta informacion es orientativa y no sustituye la valoracion de un veterinario profesional.',
      suggestedFollowUp: Array.isArray(parsed.suggestedFollowUp) ? parsed.suggestedFollowUp.slice(0, 3) : undefined,
    };

    return { response, rawResponse };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    // Return a safe fallback
    const fallback: AIHealthResponse = {
      type: 'general_info',
      message: 'Entiendo tu consulta. Lamentablemente no pude procesar la informacion completa en este momento. Te recomiendo consultar con un veterinario para una evaluacion personalizada.',
      disclaimer: 'Esta informacion es orientativa y no sustituye la valoracion de un veterinario profesional.',
    };
    return { response: fallback, rawResponse };
  }
}

function buildContextPrompt(dog: DogContext): string {
  const lines = [
    `Nombre: ${dog.name}`,
    `Raza: ${dog.breed}`,
    `Genero: ${dog.gender}`,
    `Edad: ${dog.age}`,
    `Estado: ${dog.status}`,
  ];

  if (dog.color) lines.push(`Color: ${dog.color}`);
  if (dog.microchip) lines.push(`Microchip: ${dog.microchip}`);

  if (dog.recentMedicalRecords.length > 0) {
    lines.push('\nRegistros medicos recientes:');
    for (const r of dog.recentMedicalRecords.slice(0, 5)) {
      lines.push(`- ${r.date} | ${r.type}: ${r.description}${r.diagnosis ? ` (Diagnostico: ${r.diagnosis})` : ''}`);
    }
  }

  if (dog.activeSupplements.length > 0) {
    lines.push('\nSuplementos activos:');
    for (const s of dog.activeSupplements) {
      lines.push(`- ${s.name}: ${s.dosage} (${s.frequency})`);
    }
  }

  if (dog.foodIntolerances.length > 0) {
    lines.push('\nIntolerancias alimentarias:');
    for (const i of dog.foodIntolerances) {
      lines.push(`- ${i.foodName} (${i.severity})${i.symptoms ? `: ${i.symptoms}` : ''}`);
    }
  }

  if (dog.upcomingEvents.length > 0) {
    lines.push('\nProximos eventos:');
    for (const e of dog.upcomingEvents) {
      lines.push(`- ${e.date} | ${e.type}: ${e.title}`);
    }
  }

  if (dog.geneticTests.length > 0) {
    lines.push('\nPruebas geneticas:');
    for (const t of dog.geneticTests) {
      lines.push(`- ${t.testName}: ${t.result} (${t.testDate})`);
    }
  }

  return lines.join('\n');
}

function extractMessageText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed.message) return parsed.message;
    return content;
  } catch {
    return content;
  }
}

function extractJsonFromText(text: string): string {
  // Trim whitespace
  const trimmed = text.trim();

  // Try direct parse first
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Continue
  }

  // Look for JSON between curly braces
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Continue
    }
  }

  // Look for JSON between markdown code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      JSON.parse(codeBlockMatch[1].trim());
      return codeBlockMatch[1].trim();
    } catch {
      // Continue
    }
  }

  // Fallback: return the original text and let JSON.parse fail
  return trimmed;
}
