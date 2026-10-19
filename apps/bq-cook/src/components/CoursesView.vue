<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { db, generateId, type RecordEntry } from '../db';
import { ACHATS_COL_ID, SUGGESTIONS_COL_ID, getStockRecords, getPurchaseRecords, getPlanningRecords, runStockAutomations, formatToFrenchDate } from '../db/queries';
import { findGenericProduct, cleanRayon, getCategoryFromRayon } from '../db/ticket-parser';
import { ShoppingBag, FileText, Check, X, Sparkles, ShoppingCart, Receipt, ArrowRight } from '@lucide/vue';
import { useToast } from '@bq/theme/useToast';

const toast = useToast();

const stocks = ref<RecordEntry[]>([]);
const purchases = ref<RecordEntry[]>([]);

const lastSessionPurchases = computed(() => {
  if (purchases.value.length === 0) return [];
  const lastDate = purchases.value[0].data.date;
  return purchases.value.filter(rec => rec.data.date === lastDate);
});

// Shopping List states
const autoShoppingList = ref<RecordEntry[]>([]);
const checkedItems = ref<Record<string, boolean>>({});

// Ticket Import states
const showTicketModal = ref(false);
const ticketText = ref('');
const ticketDate = ref(new Date().toISOString().split('T')[0]);
const parsedLines = ref<any[]>([]);
const isParsed = ref(false);
const isSaving = ref(false);

const loadData = async () => {
  stocks.value = await getStockRecords();
  purchases.value = await getPurchaseRecords();
  const plannings = await getPlanningRecords();
  
  // Extract ingredients needed by upcoming planned meals
  const activePlannings = plannings.filter(p => p.data.statut === 'Prévu' && !p.data.stock_decremente);
  const neededIngredientIds = new Set<string>();
  activePlannings.forEach(p => {
    (p.data.ingredients_consommes || []).forEach((id: string) => neededIngredientIds.add(id));
  });

  // Calculate automatic shopping list:
  // 1. Quantite < seuil_d_alerte strictement (quantite == seuil est considere suffisant)
  // 2. OU requis par un repas prévu et stock insuffisant
  autoShoppingList.value = stocks.value.filter(item => {
    const qty = Number(item.data.quantite || 0);
    const seuil = Number(item.data.seuil_d_alerte || 0);
    if (qty < seuil) return true;
    if (neededIngredientIds.has(item.id!) && qty < 1) return true;
    return false;
  });
};

onMounted(() => {
  loadData();
});

const openTicketModal = () => {
  ticketText.value = '';
  ticketDate.value = new Date().toISOString().split('T')[0];
  parsedLines.value = [];
  isParsed.value = false;
  showTicketModal.value = true;
};

const handleParseTicket = () => {
  if (!ticketText.value.trim()) return;

  const lines = ticketText.value.split('\n');
  const results: any[] = [];

  const MULTIPLIER_RE = /^(\d+)\s*[xX]\s*([\d,.]+)\s*(?:€|\$|\s)+\s*([\d,.]+)(?:\s+(\d+))?$/;
  const ITEM_PRICE_RE = /^(.*?)\s+([\d,]+\.\d{2}|[\d,]+)(?:\s+(\d))?$/;

  const NOISE_PATTERNS = [
    /^total\b/i, /^reste a payer/i, /^reste à payer/i, /^total a payer/i, /^total à payer/i,
    /^-+$/, /^_+$/, /^bon\s+immediat/i, /^bon\s+reduction/i, /^remise\b/i,
    /^transaction\b/i, /^la\s+ligue\s+contre\b/i, /^don\s+en\s+caisse/i,
    /^garantie\s+legale/i, /^garantie\s+constructeur/i, /dont\s+deee/i,
    /prix\s+hors\b/i, /^cb\b/i, /^cheque\b/i, /^especes\b/i, /^-{3,}/,
    /^bon\s+d'achat/i
  ];

  const isNoise = (l: string): boolean => {
    const norm = l.trim().toLowerCase();
    if (!norm) return true;
    return NOISE_PATTERNS.some(pat => pat.test(norm));
  };

  let currentRayon = 'EPICERIE';
  let idx = 0;

  while (idx < lines.length) {
    let line = lines[idx].trim();
    idx++;

    if (!line || isNoise(line)) continue;

    if (line.startsWith('>>')) {
      currentRayon = cleanRayon(line);
      continue;
    }

    let multiplierMatch = null;
    if (idx < lines.length) {
      const nextLine = lines[idx].trim();
      multiplierMatch = nextLine.match(MULTIPLIER_RE);
    }

    let articleLabel = '';
    let quantity = 1;
    let unitPrice = 0;
    let totalPrice = 0;

    if (multiplierMatch) {
      articleLabel = line;
      quantity = parseInt(multiplierMatch[1], 10);
      unitPrice = parseFloat(multiplierMatch[2].replace(',', '.'));
      totalPrice = parseFloat(multiplierMatch[3].replace(',', '.'));
      idx++;
    } else {
      const priceMatch = line.match(ITEM_PRICE_RE);
      if (!priceMatch) continue;

      articleLabel = priceMatch[1].trim();
      totalPrice = parseFloat(priceMatch[2].replace(',', '.'));
      quantity = 1;
      unitPrice = totalPrice;
    }

    articleLabel = articleLabel.replace(/[\*\-\+=]/g, '').trim();
    articleLabel = articleLabel.replace(/\b\d{13}\b/, '').trim();

    const genericName = findGenericProduct(articleLabel, currentRayon);
    let suggestedStockId = '';
    let rayonVal = currentRayon;
    let categoryVal = getCategoryFromRayon(currentRayon);

    if (genericName) {
      const matchedStock = stocks.value.find(item => String(item.data.nom || '').toLowerCase() === genericName.toLowerCase());
      if (matchedStock) {
        suggestedStockId = matchedStock.id || '';
        categoryVal = matchedStock.data.categorie || getCategoryFromRayon(rayonVal);
      }
    }

    let packSize: number | null = null;
    const g_pat = /(\d+(?:\.\d+)?)\s*g\b/i;
    const kg_pat = /(\d+(?:\.\d+)?)\s*kg\b/i;
    const ml_pat = /(\d+(?:\.\d+)?)\s*ml\b/i;
    const cl_pat = /(\d+(?:\.\d+)?)\s*cl\b/i;
    const l_pat = /(\d+(?:\.\d+)?)\s*l\b/i;
    const x_pat = /x\s*(\d+)\b/i;

    if (g_pat.test(articleLabel)) {
      packSize = parseFloat(articleLabel.match(g_pat)![1]);
    } else if (kg_pat.test(articleLabel)) {
      packSize = parseFloat(articleLabel.match(kg_pat)![1]) * 1000;
    } else if (ml_pat.test(articleLabel)) {
      packSize = parseFloat(articleLabel.match(ml_pat)![1]);
    } else if (cl_pat.test(articleLabel)) {
      packSize = parseFloat(articleLabel.match(cl_pat)![1]) * 10;
    } else if (l_pat.test(articleLabel)) {
      packSize = parseFloat(articleLabel.match(l_pat)![1]);
    } else if (x_pat.test(articleLabel)) {
      packSize = parseFloat(articleLabel.match(x_pat)![1]);
    }

    results.push({
      id: `temp-${Math.random().toString(36).substr(2, 9)}`,
      article: articleLabel,
      produit_generique: suggestedStockId,
      quantite: quantity,
      prix: unitPrice,
      prix_total: totalPrice,
      contenance_unitaire: packSize,
      rayon: rayonVal,
      categorie: categoryVal
    });
  }

  parsedLines.value = results;
  isParsed.value = true;
};

const handleSaveImportedTicket = async () => {
  if (!parsedLines.value.length) return;
  isSaving.value = true;
  try {

    let totalEstime = 0;
    for (const line of parsedLines.value) {
      // Find the product string name corresponding to the selected stock item ID
      const matchedStock = stocks.value.find(item => item.id === line.produit_generique);
      const prodGenName = matchedStock ? (matchedStock.data.nom || '') : '';

      const lineTotal = Number(line.prix_total) || (Number(line.quantite) * Number(line.prix)) || 0;
      totalEstime += lineTotal;

      const recordEntry: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: ACHATS_COL_ID,
        data: {
          date: ticketDate.value,
          article: line.article,
          produit_generique: prodGenName,
          quantite: Number(line.quantite) || 1,
          prix: Number(line.prix) || 0,
          prix_total: lineTotal,
          contenance_unitaire: line.contenance_unitaire ? Number(line.contenance_unitaire) : null,
          rayon: line.rayon,
          categorie: line.categorie
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.records.add(recordEntry);
      await runStockAutomations(recordEntry, true);
    }

    // CROSS-APP SUGGESTION TO BQ-BANK
    try {
      const sugRecord: RecordEntry = {
        id: `rec-${generateId()}`,
        collectionId: SUGGESTIONS_COL_ID,
        data: {
          source_app: 'bq-cook',
          action: 'Nouvelle Dépense',
          payload: JSON.stringify({
            date: ticketDate.value || new Date().toISOString().split('T')[0],
            montant: parseFloat(totalEstime.toFixed(2)),
            partenaire: 'Supermarché (Courses)',
            commentaire: `Achat panier de courses (${parsedLines.value.length} articles)`,
            budget: 'Courses'
          }),
          status: 'pending'
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.records.add(sugRecord);
    } catch (e) {
      console.error('Erreur creation suggestion bq-bank:', e);
    }


    showTicketModal.value = false;
    await loadData();
    toast.success(`Importation réussie ! ${parsedLines.value.length} articles enregistrés.`);
  } catch (err) {
    console.error('Erreur lors de la sauvegarde du ticket:', err);
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="courses-view">
    <div class="view-header-row">
      <div class="title-sub">
        <h2>Liste & historique</h2>
        <p class="desc">Vérifie ta liste de courses ou importe un ticket de caisse</p>
      </div>
      <button @click="openTicketModal" class="btn btn-primary btn-sm">
        <FileText class="btn-icon" /> Importer un ticket
      </button>
    </div>

    <div class="courses-grid">
      <!-- Left column: Shopping list -->
      <div class="card glass text-left list-card">
        <h3><ShoppingCart :size="18" /> Liste de courses automatique</h3>
        <p class="section-desc">Produits dont les stocks sont épuisés ou inférieurs à ton seuil d'alerte.</p>
        
        <div class="shopping-list">
          <div v-if="autoShoppingList.length === 0" class="empty-list">
            <Check class="empty-icon-green" />
            <p>Tout est en stock ! Aucun achat nécessaire pour le moment.</p>
          </div>
          
          <div 
            v-else 
            v-for="item in autoShoppingList" 
            :key="item.id" 
            class="shopping-item-row"
            :class="{ 'item-checked': checkedItems[item.id!] }"
          >
            <label class="checkbox-container">
              <input type="checkbox" v-model="checkedItems[item.id!]" />
              <span class="checkmark"></span>
              <span class="label-text">
                <span class="item-name">{{ item.data.nom }}</span>
                <span class="item-details">(Reste: {{ item.data.quantite || 0 }}, Seuil: {{ item.data.seuil_d_alerte }})</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Right column: Purchases history -->
      <div class="card glass text-left list-card">
        <h3><Receipt :size="18" /> Dernier passage en caisse</h3>
        <p v-if="lastSessionPurchases.length > 0" class="section-desc">
          Articles achetés le {{ formatToFrenchDate(lastSessionPurchases[0].data.date) }}.
        </p>
        <p v-else class="section-desc">Aucun achat récent enregistré.</p>

        <div class="history-list">
          <div v-if="lastSessionPurchases.length === 0" class="empty-list">
            <ShoppingBag class="empty-icon-muted" />
            <p>Aucun historique d'achats enregistré.</p>
          </div>
          <div v-else v-for="rec in lastSessionPurchases" :key="rec.id" class="history-item-row">
            <div class="history-left">
              <span class="hist-name">{{ rec.data.article }}</span>
              <span v-if="rec.data.produit_generique" class="hist-generic"><ArrowRight :size="12" /> {{ rec.data.produit_generique }}</span>
            </div>
            <div class="history-right">
              <span class="hist-price">{{ rec.data.prix_total }}&nbsp;€</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Ticket Import Modal Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showTicketModal" class="modal-overlay" @click.self="showTicketModal = false">
          <div class="modal-card card glass fade-in" :class="{ 'wide-modal': isParsed }">
            <div class="modal-header">
              <h2>Importer un ticket de caisse</h2>
              <button @click="showTicketModal = false" class="btn-close-modal"><X /></button>
            </div>
            
            <div class="modal-body text-left">
              <!-- Step 1: Text Saisie -->
              <div v-if="!isParsed" class="step-saisie">
                <p class="modal-intro">Colle le texte brut de ton ticket de caisse pour l'analyser automatiquement.</p>
                
                <div class="form-group mt-3">
                  <label for="tDate">Date des courses</label>
                  <input id="tDate" v-model="ticketDate" type="date" class="form-control date-input-max" />
                </div>

                <div class="form-group mt-3">
                  <label for="tText">Contenu du ticket</label>
                  <textarea id="tText" v-model="ticketText" class="form-control code-text" rows="12" placeholder=">> BOULANGERIE&#10;BAGUETTE ECO+ 0.45&#10;>> CREMERIE&#10;LAIT DEMI-ECREME X6 4.50"></textarea>
                </div>
              </div>

              <!-- Step 2: Review Parsed List -->
              <div v-else class="step-review">
                <p class="modal-intro">Voici les articles identifiés. Vérifie et ajuste la liaison avec tes produits en stock avant de valider.</p>
                
                <div class="table-container mt-3">
                  <table class="parsed-table">
                    <thead>
                      <tr>
                        <th>Article brut</th>
                        <th>Associer au produit en Stock</th>
                        <th class="text-center col-80">Qté</th>
                        <th class="text-center col-90">P.U. (€)</th>
                        <th class="text-center col-100">Pack</th>
                        <th class="text-right col-50"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(line, idx) in parsedLines" :key="line.id">
                        <td class="article-label-cell">{{ line.article }}</td>
                        <td>
                          <select v-model="line.produit_generique" class="form-control table-select">
                            <option value="">-- Aucun --</option>
                            <option v-for="stock in stocks" :key="stock.id" :value="stock.id">
                              {{ stock.data.nom }}
                            </option>
                          </select>
                        </td>
                        <td>
                          <input type="number" v-model.number="line.quantite" class="form-control text-center text-sm" />
                        </td>
                        <td>
                          <input type="number" step="0.01" v-model.number="line.prix" class="form-control text-center text-sm" />
                        </td>
                        <td>
                          <input type="number" step="1" v-model.number="line.contenance_unitaire" class="form-control text-center text-sm" placeholder="Contenance" />
                        </td>
                        <td class="text-right">
                          <button @click="parsedLines.splice(idx, 1)" class="action-btn delete" title="Supprimer la ligne">
                            <X class="action-icon" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="showTicketModal = false" class="btn btn-secondary">Annuler</button>
              <button v-if="!isParsed" @click="handleParseTicket" class="btn btn-primary" :disabled="!ticketText.trim()">
                <Sparkles class="btn-icon" /> Analyser le ticket
              </button>
              <button v-else @click="handleSaveImportedTicket" class="btn btn-primary" :disabled="isSaving">
                <Check class="btn-icon" /> {{ isSaving ? 'Enregistrement...' : 'Valider les courses' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.courses-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.courses-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.list-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 70vh;
  overflow-y: hidden;
  
  h3 {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
    color: var(--text-primary);
  }
}

.section-desc {
  font-size: 0.85rem;
  color: var(--text-sub);
  margin: 0;
}

.shopping-list, .history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding-right: 0.5rem;
  flex-grow: 1;
}

.empty-list {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  
  .empty-icon-green {
    width: 32px;
    height: 32px;
    color: var(--color-success);
  }
  
  .empty-icon-muted {
    width: 32px;
    height: 32px;
    color: var(--text-muted);
  }
}

.shopping-item-row {
  padding: 0.5rem 0.25rem;
  transition: var(--transition);
  
  &:hover {
    background-color: color-mix(in srgb, var(--color-white) 2%, transparent);
  }
  
  &.item-checked {
    opacity: 0.5;
    .item-name {
      text-decoration: line-through;
    }
  }
  
  .item-name {
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .item-details {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-left: 0.5rem;
  }
}

.history-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 0.25rem;
  border-bottom: 1px dashed var(--border-color);
  font-size: 0.9rem;
}

.history-left {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  
  .hist-date {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-muted);
  }
  
  .hist-name {
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .hist-generic {
    font-size: 0.8rem;
    color: var(--color-primary);
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
}

.history-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  
  .hist-price {
    font-weight: 800;
    color: var(--text-primary);
    white-space: nowrap;
  }
}

.trash-icon-xs {
  width: 12px;
  height: 12px;
}

/* Modal styling */
.wide-modal {
  max-width: 900px !important;
}

.date-input-max {
  max-width: 200px;
}

.col-80 {
  width: 80px;
}

.col-90 {
  width: 90px;
}

.col-100 {
  width: 100px;
}

.col-50 {
  width: 50px;
}

.code-text {
  font-family: monospace;
  font-size: 0.9rem;
  background-color: color-mix(in srgb, var(--color-black) 25%, transparent);
  line-height: 1.4;
}

.table-container {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: color-mix(in srgb, var(--color-black) 15%, transparent);
}

.parsed-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  
  th, td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  th {
    background-color: color-mix(in srgb, var(--color-black) 25%, transparent);
    font-weight: 700;
    color: var(--text-sub);
  }
}

.article-label-cell {
  font-weight: 700;
  font-family: monospace;
  font-size: 0.85rem;
}

.table-select {
  padding: 4px;
  font-size: 0.85rem;
}

.text-sm {
  font-size: 0.85rem;
  padding: 4px;
}

@media (max-width: 768px) {
  .courses-grid {
    grid-template-columns: 1fr;
  }
}
</style>
