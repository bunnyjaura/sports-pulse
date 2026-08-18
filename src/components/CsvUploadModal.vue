<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="$emit('close')">
    <div class="glass-panel modal-card glass-card-glow">
      <div class="modal-header">
        <h3><Upload :size="20" class="text-cyan" /> Import Historical CSV Dataset</h3>
        <button class="close-btn" @click="$emit('close')"><X :size="18" /></button>
      </div>

      <div class="modal-body">
        <p class="desc">
          Upload any historical match dataset from <strong>football-data.co.uk</strong> (CSV format containing <code>HomeTeam</code>, <code>AwayTeam</code>, <code>FTHG</code>, <code>FTAG</code>, <code>B365H</code>, etc.).
        </p>

        <div class="drop-zone" @dragover.prevent @drop.prevent="handleFileDrop">
          <FileText :size="40" class="text-cyan" />
          <p>Drag & Drop your CSV file here, or click to browse</p>
          <input type="file" ref="fileInput" accept=".csv" @change="handleFileSelect" class="hidden-file-input" />
          <button class="btn-outline" @click="$refs.fileInput.click()">Select CSV File</button>
        </div>

        <div v-if="uploadStatus" class="status-msg font-mono" :class="uploadStatus.type">
          {{ uploadStatus.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Upload, X, FileText } from 'lucide-vue-next';
import Papa from 'papaparse';

defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'csv-loaded']);
const uploadStatus = ref(null);

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) parseFile(file);
}

function handleFileDrop(e) {
  const file = e.dataTransfer.files[0];
  if (file) parseFile(file);
}

function parseFile(file) {
  uploadStatus.value = { type: 'info', text: 'Parsing CSV file...' };

  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.data && results.data.length) {
        uploadStatus.value = { 
          type: 'success', 
          text: `✅ Successfully imported ${results.data.length} match rows from ${file.name}!` 
        };
        setTimeout(() => {
          emit('csv-loaded', results.data);
          emit('close');
        }, 1200);
      } else {
        uploadStatus.value = { type: 'error', text: 'Failed to parse CSV or file is empty.' };
      }
    },
    error: (err) => {
      uploadStatus.value = { type: 'error', text: `CSV Error: ${err.message}` };
    }
  });
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(4, 9, 20, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  width: 90%;
  max-width: 540px;
  padding: 24px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.text-cyan { color: var(--primary-cyan); }

.desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 20px;
  line-height: 1.5;
}

.drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 32px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: var(--bg-dark);
  transition: border-color 0.2s ease;
}

.drop-zone:hover {
  border-color: var(--primary-cyan);
}

.hidden-file-input {
  display: none;
}

.status-msg {
  margin-top: 16px;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.82rem;
  text-align: center;
}

.status-msg.info { background: rgba(0, 242, 254, 0.1); color: var(--primary-cyan); }
.status-msg.success { background: rgba(16, 185, 129, 0.15); color: var(--emerald-green); }
.status-msg.error { background: rgba(239, 68, 68, 0.15); color: var(--crimson-red); }
</style>
