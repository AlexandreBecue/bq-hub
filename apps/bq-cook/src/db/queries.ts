import { db, type RecordEntry, type CollectionSchema } from './index';

// Dedicated Collection IDs
export const STOCK_COL_ID = 'col-ixd02dr3f';
export const RECIPES_COL_ID = 'col-19qpwiufk';
export const PLANNING_COL_ID = 'col-ba3rfr5qk';
export const ACHATS_COL_ID = 'col-e8jz89jel';
export const SUGGESTIONS_COL_ID = 'col-9w4b1v8zp';

/**
 * Initializes collections for bq-cook with standardized names.
 */
export async function initializeCollections() {
  const collectionsToEnsure: CollectionSchema[] = [
    {
      id: STOCK_COL_ID,
      name: 'bq-cook - stocks & ingrédients',
      description: 'Inventaire du garde-manger et gestion des stocks',
      primaryFieldKey: 'nom',
      createdAt: Date.now(),
      fields: [
        { id: 'fld-stknom', name: 'Nom', key: 'nom', type: 'text', required: true },
        { id: 'fld-stkcat', name: 'Catégorie', key: 'categorie', type: 'select', required: false },
        { id: 'fld-stkunit', name: 'Unité', key: 'unite', type: 'text', required: false },
        { id: 'fld-stkqty', name: 'Quantité', key: 'quantite', type: 'number', required: false },
        { id: 'fld-stkseuil', name: 'Seuil d\'alerte', key: 'seuil_d_alerte', type: 'number', required: false }
      ]
    },
    {
      id: RECIPES_COL_ID,
      name: 'bq-cook - recettes',
      description: 'Fiches recettes et ingrédients requis',
      primaryFieldKey: 'nom',
      createdAt: Date.now(),
      fields: [
        { id: 'fld-rcpnom', name: 'Nom', key: 'nom', type: 'text', required: true },
        { id: 'fld-rcping', name: 'Ingrédients', key: 'ingredients', type: 'relation', required: false, relatedCollectionId: STOCK_COL_ID, isMultiple: true },
        { id: 'fld-rcpprep', name: 'Temps de préparation', key: 'temps_de_preparation', type: 'number', required: false, unit: 'min' },
        { id: 'fld-rcpcook', name: 'Temps de cuisson', key: 'temps_de_cuisson', type: 'number', required: false, unit: 'min' }
      ]
    },
    {
      id: PLANNING_COL_ID,
      name: 'bq-cook - planning repas',
      description: 'Planning hebdomadaire des repas',
      primaryFieldKey: 'date',
      createdAt: Date.now(),
      fields: [
        { id: 'fld-plndate', name: 'Date', key: 'date', type: 'date', required: true },
        { id: 'fld-plnmom', name: 'Moment', key: 'moment', type: 'select', required: false, options: ['Midi', 'Soir', 'Autre'] },
        { id: 'fld-plnrec', name: 'Repas', key: 'repas', type: 'relation', required: false, relatedCollectionId: RECIPES_COL_ID },
        { id: 'fld-plning', name: 'Ingrédients consommés', key: 'ingredients_consommes', type: 'relation', required: false, relatedCollectionId: STOCK_COL_ID, isMultiple: true },
        { id: 'fld-plnstat', name: 'Statut', key: 'statut', type: 'select', required: false, options: ['Prévu', 'Préparé', 'Consommé'] }
      ]
    },
    {
      id: ACHATS_COL_ID,
      name: 'bq-cook - achats courses',
      description: 'Historique des articles achetés et tickets de caisse',
      primaryFieldKey: 'date',
      createdAt: Date.now(),
      fields: [
        { id: 'fld-achdate', name: 'Date', key: 'date', type: 'date', required: true },
        { id: 'fld-achart', name: 'Article', key: 'article', type: 'text', required: true },
        { id: 'fld-achgen', name: 'Produit générique', key: 'produit_generique', type: 'text', required: false },
        { id: 'fld-achqty', name: 'Quantité', key: 'quantite', type: 'number', required: false },
        { id: 'fld-achprix', name: 'Prix', key: 'prix', type: 'number', required: false, unit: '€' },
        { id: 'fld-achtot', name: 'Prix total', key: 'prix_total', type: 'number', required: false, unit: '€' }
      ]
    }
  ];

  for (const col of collectionsToEnsure) {
    const existing = await db.collections.get(col.id);
    if (!existing) {
      await db.collections.put(col);
    }
  }
}

/**
 * Format a YYYY-MM-DD date into DD/MM/YYYY French format
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
 * Fetch all stock records (active and not deleted)
 */
export async function getStockRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(STOCK_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Fetch all recipe records (active and not deleted)
 */
export async function getRecipeRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(RECIPES_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const valA = String(a.data.nom || '').trim();
    const valB = String(b.data.nom || '').trim();
    return valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Fetch all planning records (active and not deleted, sorted by date desc)
 */
export async function getPlanningRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(PLANNING_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    const dateA = String(a.data.date || '');
    const dateB = String(b.data.date || '');
    // Sort descending (most recent first)
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    // Secondary sort by moment (Midi before Soir)
    const momentA = String(a.data.moment || '');
    const momentB = String(b.data.moment || '');
    if (momentA === 'Midi') return -1;
    if (momentB === 'Midi') return 1;
    return 0;
  });
}

/**
 * Fetch all purchase history records (active and not deleted, sorted by date desc)
 */
export async function getPurchaseRecords(): Promise<RecordEntry[]> {
  const recs = await db.records.where('collectionId').equals(ACHATS_COL_ID).toArray();
  return recs.filter(r => !r.deletedAt).sort((a, b) => {
    return String(b.data.date || '').localeCompare(String(a.data.date || ''));
  });
}

/**
 * Run stock automations:
 * 1. Increment stock on grocery purchase (Courses - Achats)
 * 2. Decrement stock on meal prepared/consumed (Journal & Planning)
 */
export async function runStockAutomations(record: RecordEntry, isNew: boolean) {
  try {
    // 1. Grocery Purchase (Courses - Achats) -> Increment stock
    if (record.collectionId === ACHATS_COL_ID) {
      if (!isNew) return; // Only trigger on new purchase

      const productName = record.data.produit_generique;
      const quantite = Number(record.data.quantite) || 0;
      const contenance = Number(record.data.contenance_unitaire) || 0;

      if (productName && quantite > 0 && contenance > 0) {
        const stockItems = await getStockRecords();
        const stockItem = stockItems.find(item => String(item.data.nom || '').toLowerCase() === productName.toLowerCase());

        if (stockItem) {
          const currentQty = Number(stockItem.data.quantite) || 0;
          stockItem.data.quantite = Math.round((currentQty + (quantite * contenance)) * 100) / 100;
          stockItem.updatedAt = Date.now();
          await db.records.put(stockItem);
        }
      }
    }

    // 2. Meal Consumption/Preparation (Journal & Planning) -> Decrement stock
    if (record.collectionId === PLANNING_COL_ID) {
      const isConsumedOrPrepared = record.data.statut === 'Consommé' || record.data.statut === 'Préparé';
      const alreadyDecremented = record.data.stock_decremente === true;

      if (isConsumedOrPrepared && !alreadyDecremented) {
        const ingredients = record.data.ingredients_consommes || [];
        const convives = Number(record.data.convives) || 1;

        for (const ingId of ingredients) {
          const stockItem = await db.records.get(ingId);
          if (stockItem && !stockItem.deletedAt) {
            const currentQty = Number(stockItem.data.quantite) || 0;
            const portionStd = Number(stockItem.data.quantite_standard_portion) || 1;
            const decrement = convives * portionStd;

            stockItem.data.quantite = Math.max(0, Math.round((currentQty - decrement) * 100) / 100);
            stockItem.updatedAt = Date.now();
            await db.records.put(stockItem);
          }
        }

        // Mark as decremented to avoid repeating the operation
        record.data.stock_decremente = true;
        record.updatedAt = Date.now();
        await db.records.put(record);
      }
    }
  } catch (err) {
    console.error('Erreur lors de l\'exécution des automatisations de stock:', err);
  }
}

export async function generateDemoData() {
  const stockCount = await db.records.where('collectionId').equals(STOCK_COL_ID).count();
  if (stockCount > 0) return;

  const stocks = [
    { id: 'rec-stock-pates', collectionId: STOCK_COL_ID, data: { nom: 'Pâtes', quantite: 500, unite: 'g' }, createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'rec-stock-lait', collectionId: STOCK_COL_ID, data: { nom: 'Lait', quantite: 3, unite: 'L' }, createdAt: Date.now() + 1, updatedAt: Date.now() + 1 },
    { id: 'rec-stock-oeufs', collectionId: STOCK_COL_ID, data: { nom: 'Œufs', quantite: 6, unite: 'pces' }, createdAt: Date.now() + 2, updatedAt: Date.now() + 2 }
  ];
  await db.records.bulkAdd(stocks);

  const recipes = [
    {
      id: 'rec-recipe-crepes',
      collectionId: RECIPES_COL_ID,
      data: {
        nom: 'Crêpes simples',
        temps_prepa: 10,
        temps_cuisson: 15,
        ingredients: 'Farine (250g), Œufs (4), Lait (500ml), Beurre (50g)',
        instructions: '1. Mélanger la farine et les œufs.\n2. Ajouter le lait progressivement.\n3. Cuire dans une poêle chaude.'
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'rec-recipe-pates',
      collectionId: RECIPES_COL_ID,
      data: {
        nom: 'Pâtes au Beurre',
        temps_prepa: 5,
        temps_cuisson: 10,
        ingredients: 'Pâtes (200g), Beurre (20g), Sel',
        instructions: '1. Faire bouillir de l\'eau salée.\n2. Cuire les pâtes 9 minutes.\n3. Égoutter et ajouter le beurre.'
      },
      createdAt: Date.now() + 1,
      updatedAt: Date.now() + 1
    }
  ];
  await db.records.bulkAdd(recipes);
}
