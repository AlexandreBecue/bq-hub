import { db, type RecordEntry, type CollectionSchema, type FieldType, type RecordTemplate } from './index';

// Collection IDs
export const FINANCES_COL_ID = 'col-t2scpu7k7';    // Finances
export const COMPTES_COL_ID = 'col-c9mpt3s';      // Comptes Bancaires
export const BUDGETS_COL_ID = 'col-b8dg3ts';      // Enveloppes Budgétaires
export const SUGGESTIONS_COL_ID = 'col-9w4b1v8zp'; // Inbox Suggestions

/**
 * Format YYYY-MM-DD to DD/MM/YYYY
 */
export function formatToFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Initialize Dexie collections for bq-bank.
 */
export async function initializeCollections() {
  const existingCols = await db.collections.toArray();
  const colIds = existingCols.map(c => c.id);

  const newCols: CollectionSchema[] = [];

  // 1. Existing Finances Collection
  if (!colIds.includes(FINANCES_COL_ID)) {
    newCols.push({
      id: FINANCES_COL_ID,
      name: 'bq-bank - finances',
      description: 'Suivi des finances',
      createdAt: Date.now(),
      primaryFieldKey: 'date',
      fields: [
        { id: 'emzudwt0m', name: 'Date', key: 'date', type: 'date' as FieldType, required: true },
        { id: 'ty4do0t66', name: 'Type', key: 'type', type: 'select' as FieldType, required: true, options: ["Entrée", "Sortie", "Interne"] },
        { id: '6cor11a59', name: 'Montant', key: 'montant', type: 'number' as FieldType, required: true, unit: "€", decimals: 2 },
        { id: 'ejtj4cgza', name: 'Compte', key: 'compte', type: 'text' as FieldType, required: true },
        { id: '6amxoye2u', name: 'Catégorie', key: 'categorie', type: 'select' as FieldType, required: true, options: ["Revenu", "Dépense", "Cadeau", "Remboursement", "Prêt", "Vente", "Crédit", "Virement"] },
        { id: 'kl42nbbgp', name: 'Budget', key: 'budget', type: 'text' as FieldType, required: false },
        { id: 'qtmb56l6k', name: 'Partenaire', key: 'partenaire', type: 'text' as FieldType, required: false },
        { id: 'g7nrhu9f5', name: 'Commentaire', key: 'commentaire', type: 'text' as FieldType, required: false }
      ]
    });
  }

  // 2. New Accounts Collection
  if (!colIds.includes(COMPTES_COL_ID)) {
    newCols.push({
      id: COMPTES_COL_ID,
      name: 'bq-bank - comptes bancaires',
      description: 'Mes comptes de dépôt et épargne',
      createdAt: Date.now() + 10,
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-cnom', name: 'Nom du compte', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-ctype', name: 'Type de compte', key: 'type', type: 'select' as FieldType, required: true, options: ['Classique', 'Épargne', 'Investissement'] },
        { id: 'f-cactive', name: 'Actif', key: 'is_active', type: 'boolean' as FieldType, required: true }
      ]
    });
  }

  // 3. New Budgets (Envelopes) Collection
  if (!colIds.includes(BUDGETS_COL_ID)) {
    newCols.push({
      id: BUDGETS_COL_ID,
      name: 'bq-bank - enveloppes budgétaires',
      description: 'Budgets de dépenses mensuels',
      createdAt: Date.now() + 20,
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-bnom', name: 'Nom du budget', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-blimit', name: 'Plafond mensuel', key: 'plafond_mensuel', type: 'number' as FieldType, required: true, unit: "€", decimals: 2 }
      ]
    });
  }

  // 4. Suggestions Inbox Collection (Transversal)
  if (!colIds.includes(SUGGESTIONS_COL_ID)) {
    newCols.push({
      id: SUGGESTIONS_COL_ID,
      name: 'bq-bank - suggestions',
      description: 'Boîte de réception pour suggestions transversales',
      createdAt: Date.now() + 30,
      primaryFieldKey: 'source_app',
      fields: [
        { id: 'f-sugsrc', name: 'Source', key: 'source_app', type: 'text' as FieldType, required: true },
        { id: 'f-sugact', name: 'Action', key: 'action', type: 'text' as FieldType, required: true },
        { id: 'f-sugpay', name: 'Contenu', key: 'payload', type: 'text' as FieldType, required: true },
        { id: 'f-sugstat', name: 'Statut', key: 'status', type: 'text' as FieldType, required: true }
      ]
    });
  }

  if (newCols.length > 0) {
    await db.collections.bulkAdd(newCols);
    console.log(`${newCols.length} collections initialisées.`);
  }

  // Run auto-migration of accounts and budget tags from legacy records
  await performFinancialMigration();
}

/**
 * Migration of legacy account and budget text values to structured entities.
 */
export async function performFinancialMigration() {
  try {
    const finances = await db.records.where('collectionId').equals(FINANCES_COL_ID).toArray();
    
    // 1. Accounts Migration
    const accountsCount = await db.records.where('collectionId').equals(COMPTES_COL_ID).count();
    if (accountsCount === 0) {
      const uniqueAccounts = new Set<string>();
      finances.forEach(f => {
        if (f.data.compte) uniqueAccounts.add(String(f.data.compte).trim());
      });

      const newAccounts: RecordEntry[] = Array.from(uniqueAccounts).map((name, idx) => {
        let type = 'Classique';
        const lowerName = name.toLowerCase();
        if (lowerName.includes('livret') || lowerName.includes('épargne') || lowerName.includes('pel') || lowerName.includes('cel') || lowerName.includes('ldd') || lowerName.includes('lep')) {
          type = 'Épargne';
        } else if (lowerName.includes('pea') || lowerName.includes('crypto') || lowerName.includes('investissement') || lowerName.includes('bourse') || lowerName.includes('action') || lowerName.includes('titre') || lowerName.includes('assurance-vie') || lowerName.includes('assurance vie')) {
          type = 'Investissement';
        }
        return {
          id: `rec-${Math.random().toString(36).substring(2, 11)}`,
          collectionId: COMPTES_COL_ID,
          data: {
            nom: name,
            type: type,
            is_active: true
          },
          createdAt: Date.now() + idx * 10,
          updatedAt: Date.now() + idx * 10
        };
      });

      if (newAccounts.length > 0) {
        await db.records.bulkAdd(newAccounts);
        console.log(`Migrated ${newAccounts.length} bank accounts.`);
      }
    }

    // 2. Budget Envelopes Migration
    const budgetsCount = await db.records.where('collectionId').equals(BUDGETS_COL_ID).count();
    if (budgetsCount === 0) {
      const uniqueBudgets = new Set<string>();
      finances.forEach(f => {
        if (f.data.budget) uniqueBudgets.add(String(f.data.budget).trim());
      });

      const newBudgets: RecordEntry[] = Array.from(uniqueBudgets).map((name, idx) => ({
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: BUDGETS_COL_ID,
        data: {
          nom: name,
          plafond_mensuel: 150
        },
        createdAt: Date.now() + idx * 10,
        updatedAt: Date.now() + idx * 10
      }));

      if (newBudgets.length > 0) {
        await db.records.bulkAdd(newBudgets);
        console.log(`Migrated ${newBudgets.length} budget envelopes.`);
      }
    }

  } catch (err) {
    console.error('Error during financial migration:', err);
  }
}

/**
 * Core record getters
 */
export async function getFinancesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(FINANCES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

export async function getComptesRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(COMPTES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

export async function getBudgetsRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(BUDGETS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

export async function getSuggestionsRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(SUGGESTIONS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt && r.data.status === 'pending').sort((a, b) => {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/**
 * Calculates dynamic bank accounts balances.
 * Returns a map/dictionary of: Account Name -> Solde Réel
 */
export function calculateAccountBalances(
  allAccounts: RecordEntry[],
  allFinances: RecordEntry[]
): Record<string, number> {
  const balances: Record<string, number> = {};

  // 1. Initialize balances with 0 (since solde_initial was removed)
  allAccounts.forEach(acc => {
    balances[acc.data.nom] = 0;
  });

  // 2. Iterate through all historical transactions and apply amounts
  allFinances.forEach(t => {
    const accName = String(t.data.compte || '').trim();
    if (balances[accName] === undefined) {
      // Legacy account not explicitly declared in fleet yet
      balances[accName] = 0;
    }

    const type = t.data.type; // Entrée, Sortie, Interne
    const amount = Number(t.data.montant) || 0;

    if (type === 'Entrée') {
      balances[accName] += amount;
    } else if (type === 'Sortie') {
      balances[accName] -= amount;
    } else if (type === 'Interne') {
      // Virement interne : de 'compte' (émetteur) vers 'partenaire' (récepteur)
      // 1. Débiter le compte source (compte)
      balances[accName] -= amount;

      // 2. Créditer le compte cible (partenaire), si c'est un compte de notre portefeuille
      const destAccName = String(t.data.partenaire || '').trim();
      if (destAccName) {
        // Si le compte de destination est connu de notre portefeuille mais pas encore initialisé
        if (balances[destAccName] === undefined) {
          const exists = allAccounts.some(acc => acc.data.nom === destAccName);
          if (exists) {
            balances[destAccName] = 0;
          }
        }

        if (balances[destAccName] !== undefined) {
          balances[destAccName] += amount;
        }
      }
    }
    });

  return balances;
}

/**
 * Fetch all saved recurring templates for Finances
 */
export async function getFinancesTemplates(): Promise<RecordTemplate[]> {
  const temps = await db.templates.where('collectionId').equals(FINANCES_COL_ID).toArray();
  return temps.filter(t => !t.deletedAt).sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
  });
}

export async function generateDemoData() {
  const compteCount = await db.records.where('collectionId').equals(COMPTES_COL_ID).count();
  if (compteCount > 0) return;

  const accounts = [
    { id: 'rec-compte-courant', collectionId: COMPTES_COL_ID, data: { nom: 'Compte Courant', type: 'Classique', is_active: true }, createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'rec-livret-a', collectionId: COMPTES_COL_ID, data: { nom: 'Livret A', type: 'Épargne', is_active: true }, createdAt: Date.now() + 1, updatedAt: Date.now() + 1 }
  ];
  await db.records.bulkAdd(accounts);

  const budgets = [
    { id: 'rec-budget-courses', collectionId: BUDGETS_COL_ID, data: { nom: 'Courses', plafond_mensuel: 400 }, createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'rec-budget-loisirs', collectionId: BUDGETS_COL_ID, data: { nom: 'Loisirs', plafond_mensuel: 150 }, createdAt: Date.now() + 1, updatedAt: Date.now() + 1 }
  ];
  await db.records.bulkAdd(budgets);

  const finances = [
    {
      id: 'rec-finance-1',
      collectionId: FINANCES_COL_ID,
      data: {
        date: new Date().toISOString().split('T')[0],
        type: 'Entrée',
        montant: 2500,
        compte: 'Compte Courant',
        categorie: 'Revenu',
        budget: '',
        partenaire: 'Employeur',
        commentaire: 'Salaire mensuel'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'rec-finance-2',
      collectionId: FINANCES_COL_ID,
      data: {
        date: new Date().toISOString().split('T')[0],
        type: 'Sortie',
        montant: 65.50,
        compte: 'Compte Courant',
        categorie: 'Dépense',
        budget: 'Courses',
        partenaire: 'Supermarché',
        commentaire: 'Courses de la semaine'
      },
      createdAt: Date.now() + 1,
      updatedAt: Date.now() + 1
    },
    {
      id: 'rec-finance-3',
      collectionId: FINANCES_COL_ID,
      data: {
        date: new Date().toISOString().split('T')[0],
        type: 'Interne',
        montant: 500,
        compte: 'Compte Courant',
        categorie: 'Virement',
        budget: '',
        partenaire: 'Livret A',
        commentaire: 'Épargne mensuelle'
      },
      createdAt: Date.now() + 2,
      updatedAt: Date.now() + 2
    }
  ];
  await db.records.bulkAdd(finances);
}
