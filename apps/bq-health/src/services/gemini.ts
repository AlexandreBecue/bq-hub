/**
 * Gemini AI Medical Assistant Service for bq-health
 */

export function getGeminiApiKey(): string {
  return (
    localStorage.getItem('bq_health_gemini_api_key') ||
    localStorage.getItem('bq_gemini_api_key') ||
    localStorage.getItem('bq_watch_gemini_api_key') ||
    ''
  );
}

export function setGeminiApiKey(key: string) {
  const clean = key.trim();
  localStorage.setItem('bq_health_gemini_api_key', clean);
  localStorage.setItem('bq_gemini_api_key', clean); // share with hub
}

export function getGeminiModel(): string {
  const model = localStorage.getItem('bq_health_gemini_model') || 'gemini-2.5-flash';
  return model.replace(/^models\//, '').trim();
}

export function setGeminiModel(model: string) {
  const clean = (model || 'gemini-2.5-flash').replace(/^models\//, '').trim();
  localStorage.setItem('bq_health_gemini_model', clean);
}

export async function listAvailableGeminiModels(apiKey?: string): Promise<Array<{ id: string; label: string }>> {
  const key = apiKey || getGeminiApiKey();
  if (!key) return [];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!res.ok) {
      throw new Error(`Erreur récupération modèles (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data.models)) {
      return data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          id: m.name.replace(/^models\//, ''),
          label: m.displayName || m.name.replace(/^models\//, '')
        }));
    }
    return [];
  } catch (err) {
    console.error('Erreur API Gemini listModels:', err);
    return [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommandé)' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
    ];
  }
}

export interface MedicalContext {
  activeTreatments: Array<{ nom: string; posologie: string; type: string }>;
  recentIntakes: Array<{ nom: string; quantite: number; date: string; heure: string; motif?: string }>;
  allergies?: string;
  bloodType?: string;
}

/**
 * Ask Gemini for advice on autonomous medication, dosages, and drug-drug interactions
 */
export async function askMedicationAdvice(question: string, context: MedicalContext): Promise<string> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error("Clé d'API Gemini non renseignée. Veuillez la configurer dans les Paramètres.");
  }

  const model = getGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const treatmentsSummary = context.activeTreatments.length > 0
    ? context.activeTreatments.map(t => `- ${t.nom} (${t.posologie}) [${t.type}]`).join('\n')
    : "Aucun traitement régulier actif.";

  const intakesSummary = context.recentIntakes.length > 0
    ? context.recentIntakes.slice(0, 5).map(i => `- ${i.nom} (qté: ${i.quantite}) le ${i.date} à ${i.heure}${i.motif ? ` (motif: ${i.motif})` : ''}`).join('\n')
    : "Aucune prise récente enregistrée.";

  const systemPrompt = `Tu es l'assistant de santé et pharmacologique intelligent intégré à l'application personnelle bq-health.
Ton rôle est d'informer avec bienveillance et rigueur sur la médication autonome (ex: Doliprane/paracétamol, Spasfon, Lysopaïne, Ibuprofène, etc.), en tenant compte rigoureusement du profil du patient :

PROFIL SANTÉ DU PATIENT :
- Traitements réguliers en cours :
${treatmentsSummary}
- Médicaments pris récemment (dernières 24h-48h) :
${intakesSummary}
- Allergies / Intolérances déclarées : ${context.allergies || 'Aucune connue'}
- Groupe sanguin : ${context.bloodType || 'Inconnu'}

RÈGLES D'OR DE RÉPONSE :
1. Analyse spécifiquement les risques d'interactions médicamenteuses, de surdosage (ex: max 3-4g/jour de paracétamol espacé d'au moins 4 à 6h) et les contre-indications (ex: AINS/ibuprofène vs infections, antécédents, ulcères).
2. Sois clair, concis, pédagogique et structuré (en listant : Feu vert / Attention / Posologie recommandée / Précautions).
3. Ajoute toujours un rappel bienveillant invitant à demander confirmation à son médecin ou pharmacien en cas de doute persistant ou de symptômes inhabituels.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: `${systemPrompt}\n\nQUESTION DU PATIENT :\n"${question}"` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erreur Gemini (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const reply = candidate?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error("L'assistant Gemini n'a pas pu formuler de réponse.");
  }

  return reply;
}

/**
 * Debrief and explain a medical document (ordonnance, bilan sanguin, scanner, IRM, compte-rendu)
 */
export async function debriefMedicalDocument(
  documentText: string,
  imageAttachment?: { dataBase64: string; mimeType: string }
): Promise<string> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error("Clé d'API Gemini non renseignée. Veuillez la configurer dans les Paramètres.");
  }

  const model = getGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const systemInstructions = `Tu es un médecin et vulgarisateur scientifique bienveillant au sein de l'application de santé personnelle bq-health.
L'utilisateur te soumet un document médical (ordonnance, bilan biologique sanguin/urinaire, compte-rendu d'imagerie IRM/scanner/radio, ou compte-rendu opératoire).

Ta mission est de décrypter ce document :
1. **Résumé clair en français accessible** : expliquer les termes médicaux complexes et la conclusion principale.
2. **Points d'attention / Valeurs clés** : mettre en évidence les éléments normaux (rassurants) et les éventuelles anomalies qui nécessitent un suivi.
3. **Médicaments ou examens identifiés** : lister clairement les médicaments prescrits avec leur posologie et leur rôle.
4. **Questions à poser au médecin traitant** : 1 ou 2 questions pertinentes que le patient peut poser lors de sa prochaine consultation.

Garde un ton empathique, rassurant et professionnel.`;

  const parts: any[] = [];
  parts.push({ text: `${systemInstructions}\n\nDOCUMENT TRANSMIS PAR LE PATIENT :\n${documentText || '(Document transmis en pièce jointe ci-dessous)'}` });

  if (imageAttachment) {
    parts.push({
      inlineData: {
        data: imageAttachment.dataBase64,
        mimeType: imageAttachment.mimeType
      }
    });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erreur Gemini (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const reply = candidate?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error("L'assistant Gemini n'a pas pu décrypter ce document.");
  }

  return reply;
}
