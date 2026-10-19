export interface UserProfileConfig {
  name: string;
  preferences: string;
}

const DEFAULT_PROFILE: UserProfileConfig = {
  name: '',
  preferences: ''
};

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
 * Sends a message in the debriefing chat with Gemini.
 */
export async function sendDebriefMessage(
  history: Array<{ role: 'user' | 'model'; text: string }>,
  movieTitle: string,
  userPastContext: string,
  modelName = 'gemini-1.5-flash'
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Clé API Gemini manquante. Veuillez la configurer dans les Paramètres.');
  }

  const profile = getUserProfile();
  const systemPrompt = buildSystemPrompt(profile);
  const userName = profile.name || 'l’utilisateur';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur API Gemini (${res.status}): ${err}`);
  }

  const data = await res.json();
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
  modelName = 'gemini-1.5-flash'
): Promise<{ avis: string; note: number; mention: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Clé API Gemini manquante. Veuillez la configurer dans les Paramètres.');
  }

  const profile = getUserProfile();
  const systemPrompt = buildSystemPrompt(profile);
  const userName = profile.name || 'l’utilisateur';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `${systemPrompt}\n\n${userPastContext}\n\nVoici l'échange complet avec ${userName} concernant "${movieTitle}" :\n` +
    history.map(h => `${h.role === 'user' ? userName : 'IA'}: ${h.text}`).join('\n') +
    `\n\nMISSION :\nSur la base de cet échange et de ses avis historiques, génère au format JSON STRICT :\n` +
    `{\n` +
    `  "mention": "Chef-d’œuvre | Très fortement apprécié | Aimé | Apprécié | Mitigé | Peu apprécié",\n` +
    `  "note": <nombre flottant entre 0.0 et 10.0, par exemple 8.0>,\n` +
    `  "avis": "<synthèse rédigée dans le style exact de ${userName} : mention globale en première phrase, puis ses points forts marquants, ses réserves et comparaisons>"\n` +
    `}\n` +
    `Réponds UNIQUEMENT avec le bloc JSON valide, sans texte additionnel.`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur API Gemini (${res.status}): ${err}`);
  }

  const data = await res.json();
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
