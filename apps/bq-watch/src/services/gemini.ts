export interface UserProfileConfig {
  name: string;
  preferences: string;
}

const DEFAULT_PROFILE: UserProfileConfig = {
  name: '',
  preferences: ''
};

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export const POPULAR_GEMINI_MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommandé - Rapide et moderne)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Dernière génération)' },
  { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash Latest' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { id: 'gemini-2.0-pro-exp', label: 'Gemini 2.0 Pro Experimental' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

export function getUserProfile(): UserProfileConfig {
  const saved = localStorage.getItem('bq_watch_user_profile');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        name: parsed.name || 'Cinéphile',
        preferences: parsed.preferences || ''
      };
    } catch {}
  }
  return DEFAULT_PROFILE;
}

export function setUserProfile(profile: UserProfileConfig) {
  localStorage.setItem('bq_watch_user_profile', JSON.stringify({
    name: profile.name.trim() || 'Cinéphile',
    preferences: profile.preferences.trim()
  }));
}

export function getGeminiApiKey(): string {
  return localStorage.getItem('bq_watch_gemini_api_key') || '';
}

export function setGeminiApiKey(key: string) {
  localStorage.setItem('bq_watch_gemini_api_key', key.trim());
}

export function getGeminiModel(): string {
  return localStorage.getItem('bq_watch_gemini_model') || DEFAULT_GEMINI_MODEL;
}

export function setGeminiModel(model: string) {
  localStorage.setItem('bq_watch_gemini_model', model.trim() || DEFAULT_GEMINI_MODEL);
}

export async function listAvailableGeminiModels(apiKey?: string): Promise<Array<{ id: string; label: string }>> {
  const key = apiKey || getGeminiApiKey();
  if (!key) return [];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.models)) {
      return data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => {
          const id = m.name.replace(/^models\//, '');
          return {
            id,
            label: m.displayName ? `${m.displayName} (${id})` : id
          };
        });
    }
  } catch (err) {
    console.warn('Impossible de récupérer la liste des modèles Gemini:', err);
  }
  return [];
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export function buildSystemPrompt(profile?: UserProfileConfig): string {
  const p = profile || getUserProfile();
  const userName = p.name || 'l’utilisateur';

  return `Tu es un assistant cinéphile personnel et dévoué.
Ton rôle est d'aider ${userName} à débriefer ses visionnages de films et séries, à formuler son ressenti avec précision, à lui suggérer une note sur 10 juste et cohérente, et à rédiger une synthèse fidèle à son style d'expression.

PROFIL ET GOÛTS CINÉMATOGRAPHIQUES DE ${userName.toUpperCase()} :
${p.preferences || 'Apprécie les scénarios soignés, les bonnes interprétations et les rythmes maîtrisés.'}

RÈGLES DE CONVERSATION :
1. Sois chaleureux, concis et pertinent. Ne fais pas de longs monologues.
2. Pose 1 à 2 questions courtes et ciblées pour faire réagir ${userName} sur ce qui compte pour lui/elle (le rythme, les choix des personnages, la mise en scène, le dénouement, l’attachement émotionnel).
3. Fais des ponts spontanés et pertinents avec des films qu'il/elle a déjà vus dans son historique pour situer son curseur d'appréciation.
4. Reste toujours en français.`;
}

/**
 * Robust execution of Gemini API with automatic fallback in case of 404 (model not found / deprecated).
 */
async function callGeminiApi(
  body: any,
  requestedModel?: string
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Clé API Gemini manquante. Veuillez la configurer dans les Paramètres.');
  }

  const primaryModel = requestedModel || getGeminiModel() || DEFAULT_GEMINI_MODEL;

  // Build ordered list of candidates to try in case of 404
  const candidateModels = Array.from(new Set([
    primaryModel,
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-001',
    'gemini-1.5-flash'
  ]));

  let lastError = '';

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        // If we fell back to a different model and it worked, remember it!
        if (model !== primaryModel) {
          console.info(`Modèle Gemini basculé avec succès sur "${model}".`);
          setGeminiModel(model);
        }
        return await res.json();
      }

      const errText = await res.text();
      lastError = errText;

      // Only continue to fallback if it's a 404 (model not found / not supported for generateContent)
      if (res.status === 404) {
        console.warn(`Modèle Gemini "${model}" non trouvé (404), tentative avec le modèle suivant...`);
        continue;
      }

      // For other HTTP error codes (e.g. 400 bad request, 401/403 auth, 429 rate limit), abort immediately
      throw new Error(`Erreur API Gemini (${res.status}): ${errText}`);
    } catch (err: any) {
      if (err.message && err.message.startsWith('Erreur API Gemini')) {
        throw err;
      }
      lastError = err.message || String(err);
    }
  }

  throw new Error(`Aucun modèle Gemini compatible n'a pu répondre. Dernière erreur: ${lastError}`);
}

/**
 * Sends a message in the debriefing chat with Gemini.
 */
export async function sendDebriefMessage(
  history: Array<{ role: 'user' | 'model'; text: string }>,
  movieTitle: string,
  userPastContext: string,
  modelName?: string
): Promise<string> {
  const profile = getUserProfile();
  const systemPrompt = buildSystemPrompt(profile);
  const userName = profile.name || 'l’utilisateur';

  const contents: GeminiMessage[] = [
    {
      role: 'user',
      parts: [
        {
          text: `${systemPrompt}\n\n${userPastContext}\n\n[CONTEXTE ACTUEL DU FILM À DÉBRIEFER] : "${movieTitle}". ${userName} vient de le terminer.`
        }
      ]
    },
    {
      role: 'model',
      parts: [
        {
          text: `C'est parti pour le débrief de "${movieTitle}" ! J'ai bien en tête tes références et tes avis passés. Qu'en as-tu pensé globalement ?`
        }
      ]
    }
  ];

  for (const m of history) {
    contents.push({
      role: m.role,
      parts: [{ text: m.text }]
    });
  }

  const data = await callGeminiApi({ contents }, modelName);
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return reply || "Je n'ai pas pu générer de réponse.";
}

/**
 * Analyzes the entire debrief conversation to generate a structured review and suggested rating.
 */
export async function generateFinalReviewAndRating(
  history: Array<{ role: 'user' | 'model'; text: string }>,
  movieTitle: string,
  userPastContext: string,
  modelName?: string
): Promise<{ avis: string; note: number; mention: string }> {
  const profile = getUserProfile();
  const systemPrompt = buildSystemPrompt(profile);
  const userName = profile.name || 'l’utilisateur';

  const prompt = `${systemPrompt}\n\n${userPastContext}\n\nVoici l'échange complet avec ${userName} concernant "${movieTitle}" :\n` +
    history.map(h => `${h.role === 'user' ? userName : 'IA'}: ${h.text}`).join('\n') +
    `\n\nMISSION :\nSur la base de cet échange et de ses avis historiques, génère au format JSON STRICT :\n` +
    `{\n` +
    `  "mention": "Chef-d’œuvre | Très fortement apprécié | Aimé | Apprécié | Mitigé | Peu apprécié",\n` +
    `  "note": <nombre flottant entre 0.0 et 10.0, par exemple 8.0>,\n` +
    `  "avis": "<synthèse rédigée dans le style exact de ${userName} : mention globale en première phrase, puis ses points forts marquants, ses réserves et comparaisons>"\n` +
    `}\n` +
    `Réponds UNIQUEMENT avec le bloc JSON valide, sans texte additionnel.`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const data = await callGeminiApi(body, modelName);
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Réponse vide de Gemini.');
  }

  try {
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      avis: parsed.avis || '',
      note: typeof parsed.note === 'number' ? parsed.note : 7.0,
      mention: parsed.mention || 'Aimé'
    };
  } catch (err) {
    console.error('Erreur parsing JSON Gemini:', rawText, err);
    return {
      avis: rawText,
      note: 7.0,
      mention: 'Aimé'
    };
  }
}
