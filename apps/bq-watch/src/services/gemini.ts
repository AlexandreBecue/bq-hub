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

export function getGeminiModel(): string {
  const model = localStorage.getItem('bq_watch_gemini_model') || '';
  return model.replace(/^models\//, '').trim();
}

export function setGeminiModel(model: string) {
  const clean = (model || '').replace(/^models\//, '').trim();
  localStorage.setItem('bq_watch_gemini_model', clean);
}

export function getStoredAvailableModels(): Array<{ id: string; label: string }> {
  const saved = localStorage.getItem('bq_watch_available_models');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export function setStoredAvailableModels(models: Array<{ id: string; label: string }>) {
  localStorage.setItem('bq_watch_available_models', JSON.stringify(models));
}

/**
 * Effectue un micro-ping pour vérifier si le modèle est réellement actif
 * et n'est pas déprécié (retourne 404 "no longer available").
 */
async function isModelActive(modelId: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });
    // 404 signifie que le modèle est retiré / non disponible pour cette clé
    if (res.status === 404) {
      return false;
    }
    // 200, 400 ou 429 signifient que le modèle est bien existant et reconnu
    return true;
  } catch {
    return true;
  }
}

export async function listAvailableGeminiModels(apiKey?: string): Promise<Array<{ id: string; label: string }>> {
  const key = apiKey || getGeminiApiKey();
  if (!key) return [];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erreur récupération modèles (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (Array.isArray(data.models)) {
      // 1. Filtrer les modèles de génération Gemini
      const candidates = data.models
        .filter((m: any) => 
          m.supportedGenerationMethods?.includes('generateContent') &&
          typeof m.name === 'string' &&
          m.name.includes('gemini')
        )
        .map((m: any) => {
          const id = m.name.replace(/^models\//, '').trim();
          return {
            id,
            label: m.displayName ? `${m.displayName} (${id})` : id
          };
        });

      // 2. Trier : modèles Flash en priorité, puis versions les plus récentes en haut
      candidates.sort((a: { id: string; label: string }, b: { id: string; label: string }) => {
        const aIsFlash = a.id.includes('flash') ? 1 : 0;
        const bIsFlash = b.id.includes('flash') ? 1 : 0;
        if (aIsFlash !== bIsFlash) return bIsFlash - aIsFlash;
        return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
      });

      // 3. Tester la disponibilité réelle en parallèle pour écarter les 404 (obsolètes / non disponibles)
      const checks = await Promise.allSettled(
        candidates.map(async (candidate: { id: string; label: string }) => {
          const active = await isModelActive(candidate.id, key);
          return active ? candidate : null;
        })
      );

      const verified = checks
        .map(result => result.status === 'fulfilled' ? result.value : null)
        .filter((item): item is { id: string; label: string } => item !== null);

      const finalModels = verified.length > 0 ? verified : candidates;
      setStoredAvailableModels(finalModels);
      return finalModels;
    }
  } catch (err: any) {
    console.warn('Impossible de récupérer la liste des modèles Gemini:', err);
    throw err;
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
 * Direct execution of Gemini API with the exact user-selected model.
 * Includes automatic retry on transient overload errors (HTTP 503).
 */
async function callGeminiApi(
  body: any,
  requestedModel?: string
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Clé API Gemini manquante. Veuillez la configurer dans les Paramètres.');
  }

  const model = (requestedModel || getGeminiModel() || '').replace(/^models\//, '').trim();
  if (!model) {
    throw new Error('Aucun modèle Gemini sélectionné. Veuillez vous rendre dans les Paramètres et cliquer sur "Détecter les modèles".');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        return await res.json();
      }

      // Si erreur 503 (saturation temporaire des serveurs), attendre 1.5s et retenter
      if (res.status === 503 && attempts < maxAttempts) {
        console.warn(`Serveur Gemini en forte demande (503). Nouvelle tentative dans 1.5s (essai ${attempts}/${maxAttempts})...`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const jsonErr = JSON.parse(errText);
        if (jsonErr.error?.message) {
          parsedMsg = jsonErr.error.message;
        }
      } catch {}

      if (res.status === 503) {
        throw new Error(`503_UNAVAILABLE: ${parsedMsg}`);
      }

      throw new Error(`Erreur API Gemini pour le modèle "${model}" (${res.status}): ${parsedMsg}`);
    } catch (err: any) {
      if (err.message && (err.message.startsWith('503_UNAVAILABLE') || err.message.startsWith('Erreur API Gemini'))) {
        throw err;
      }
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
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
