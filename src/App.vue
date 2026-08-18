<template>
  <div class="app-container">
    <!-- Header Navbar with Live Sync Button -->
    <HeaderNav 
      :activeTab="currentTab" 
      :cutoffDate="cutoffDate"
      :isSyncing="isSyncing"
      @select-tab="currentTab = $event"
      @open-csv="isCsvModalOpen = true"
      @fetch-live="triggerLiveSync"
    />

    <!-- Main Content Area based on selected Tab -->
    <main class="main-content">
      <UpcomingFixtures v-if="currentTab === 'upcoming'" />

      <PastMatchesTester v-else-if="currentTab === 'pastmatches'" />

      <DashboardOverview v-else-if="currentTab === 'dashboard'" />
      
      <WalkForwardTester v-else-if="currentTab === 'walkforward'" />
      
      <MonteCarloLab v-else-if="currentTab === 'montecarlo'" />
      
      <ValueBetsTable v-else-if="currentTab === 'valuebets'" />
    </main>

    <!-- CSV Drag & Drop Upload Modal -->
    <CsvUploadModal 
      :isOpen="isCsvModalOpen"
      @close="isCsvModalOpen = false"
      @csv-loaded="handleCsvLoaded"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import HeaderNav from './components/HeaderNav.vue';
import UpcomingFixtures from './components/UpcomingFixtures.vue';
import PastMatchesTester from './components/PastMatchesTester.vue';
import DashboardOverview from './components/DashboardOverview.vue';
import WalkForwardTester from './components/WalkForwardTester.vue';
import MonteCarloLab from './components/MonteCarloLab.vue';
import ValueBetsTable from './components/ValueBetsTable.vue';
import CsvUploadModal from './components/CsvUploadModal.vue';
import { fetchLiveMatchData } from './utils/liveDataFetcher';

const currentTab = ref('upcoming');
const cutoffDate = ref('2026-08-16');
const isCsvModalOpen = ref(false);
const isSyncing = ref(false);

async function triggerLiveSync() {
  isSyncing.value = true;
  try {
    const liveMatches = await fetchLiveMatchData();
    console.log('Fetched dynamic live matches:', liveMatches.length);
  } catch (err) {
    console.error('Dynamic sync error:', err);
  } finally {
    isSyncing.value = false;
  }
}

function handleCsvLoaded(parsedData) {
  console.log('CSV Loaded:', parsedData.length, 'rows');
}
</script>

<style scoped>
.main-content {
  min-height: 80vh;
}
</style>
