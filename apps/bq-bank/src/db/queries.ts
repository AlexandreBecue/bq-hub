import { db, type RecordEntry, type CollectionSchema, type FieldType } from './index';

// Collection IDs
export const FINANCES_COL_ID = 'col-t2scpu7k7';    // Finances (Existant)
export const COMPTES_COL_ID = 'col-c9mpt3s';      // Comptes Bancaires (Nouveau)
export const BUDGETS_COL_ID = 'col-b8dg3ts';      // Enveloppes Budgétaires (Nouveau)
export const SUGGESTIONS_COL_ID = 'col-1nb0x-sug'; // Inbox Suggestions (Transversal)

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
      name: 'Finances',
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
      name: 'Comptes Bancaires',
      description: 'Mes comptes de dépôt et épargne',
      createdAt: Date.now() + 10,
      primaryFieldKey: 'nom',
      fields: [
        { id: 'f-cnom', name: 'Nom du compte', key: 'nom', type: 'text' as FieldType, required: true },
        { id: 'f-csolde', name: 'Solde initial', key: 'solde_initial', type: 'number' as FieldType, required: true, unit: "€", decimals: 2 },
        { id: 'f-cactive', name: 'Actif', key: 'is_active', type: 'boolean' as FieldType, required: true }
      ]
    });
  }

  // 3. New Budgets (Envelopes) Collection
  if (!colIds.includes(BUDGETS_COL_ID)) {
    newCols.push({
      id: BUDGETS_COL_ID,
      name: 'Enveloppes Budgétaires',
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
      name: 'Inbox / Suggestions',
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

      // Default fallback accounts if no records exist at all
      if (uniqueAccounts.size === 0) {
        uniqueAccounts.add('Compte Courant');
        uniqueAccounts.add('Livret A');
        uniqueAccounts.add('Liquide');
      }

      const newAccounts: RecordEntry[] = Array.from(uniqueAccounts).map((name, idx) => ({
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: COMPTES_COL_ID,
        data: {
          nom: name,
          solde_initial: name === 'Compte Courant' ? 1000 : 0,
          is_active: true
        },
        createdAt: Date.now() + idx * 10,
        updatedAt: Date.now() + idx * 10
      }));

      await db.records.bulkAdd(newAccounts);
      console.log(`Migrated ${newAccounts.length} bank accounts.`);
    }

    // 2. Budget Envelopes Migration
    const budgetsCount = await db.records.where('collectionId').equals(BUDGETS_COL_ID).count();
    if (budgetsCount === 0) {
      const uniqueBudgets = new Set<string>();
      finances.forEach(f => {
        if (f.data.budget) uniqueBudgets.add(String(f.data.budget).trim());
      });

      // Default fallback budgets if empty
      if (uniqueBudgets.size === 0) {
        uniqueBudgets.add('Courses');
        uniqueBudgets.add('Loisirs');
        uniqueBudgets.add('Voiture');
        uniqueBudgets.add('Logement');
      }

      const newBudgets: RecordEntry[] = Array.from(uniqueBudgets).map((name, idx) => ({
        id: `rec-${Math.random().toString(36).substring(2, 11)}`,
        collectionId: BUDGETS_COL_ID,
        data: {
          nom: name,
          plafond_mensuel: name === 'Courses' ? 400 : name === 'Loisirs' ? 200 : 150
        },
        createdAt: Date.now() + idx * 10,
        updatedAt: Date.now() + idx * 10
      }));

      await db.records.bulkAdd(newBudgets);
      console.log(`Migrated ${newBudgets.length} budget envelopes.`);
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

  // 1. Initialize balances with Solde Initial
  allAccounts.forEach(acc => {
    balances[acc.data.nom] = Number(acc.data.solde_initial) || 0;
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
      // Internal transfers. How to handle?
      // In our v0, we recommend recording a Transfer as a Sortie from Account A and an Entrée into Account B.
      // But if there is a single transaction marked as 'Interne', wait, how does it affect the account?
      // For legacy data compatibility: if they recorded it as a single line, did it have negative amount? 
      // Usually, to keep it mathematically correct, we treat 'Interne' as neutral, OR if they wrote two lines:
      // - line 1: type=Sortie (or Interne, amount=negative)
      // - line 2: type=Entrée (or Interne, amount=positive)
      // If we treat amount as signed: if amount < 0 subtract, if amount > 0 add.
      // Let's implement this: if type is 'Interne' and amount is positive/negative, apply it directly.
      // But standard is: let's treat 'Interne' as signed!
      balances[accName] += amount; // adds positive, subtracts negative!
    }
  });

  return balances;
}
