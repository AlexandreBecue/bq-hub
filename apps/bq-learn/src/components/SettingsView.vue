<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '../db/index';
import { syncEngine } from '../db/google-drive';
import { seedDefaultQuizIfEmpty } from '../db/queries';
import BaseSettings from '@bq/theme/BaseSettings.vue';

const emit = defineEmits(['data-updated']);

const isDbEmpty = ref(true);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const checkDbStatus = async () => {
  const count = await db.records.count();
  isDbEmpty.value = count === 0;
};

onMounted(async () => {
  await checkDbStatus();
});

const handleDataUpdated = async () => {
  await checkDbStatus();
  emit('data-updated');
};

const handleClearDatabase = async () => {
  await checkDbStatus();
  emit('data-updated');
};

const handleGenerateDemo = async () => {
  await seedDefaultQuizIfEmpty();
  await checkDbStatus();
  emit('data-updated');
};
</script>

<template>
  <BaseSettings
    :db="db"
    :syncEngine="syncEngine"
    :clientId="clientId"
    :isDbEmpty="isDbEmpty"
    exportFileNamePrefix="bq-learn"
    @data-updated="handleDataUpdated"
    @clear-database="handleClearDatabase"
    @generate-demo="handleGenerateDemo"
  />
</template>
