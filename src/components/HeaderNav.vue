<template>
  <header class="header-nav glass-panel glass-card-glow">
    <div class="header-top-row">
      <div class="header-left">
        <div class="logo-box">
          <Activity class="logo-icon text-cyan" :size="28" />
          <div>
            <h1 class="logo-title">SportPulse <span class="text-gradient-cyan">AI</span></h1>
            <p class="logo-subtitle">Dynamic Hybrid Ensemble Predictor</p>
          </div>
        </div>
      </div>

      <div class="header-right">
        <!-- Desktop Quick Action Buttons -->
        <div class="desktop-actions">
          <button class="btn-primary btn-sm" @click="$emit('fetch-live')" :disabled="isSyncing">
            <RefreshCw :size="15" :class="{ 'spin-icon': isSyncing }" />
            <span class="btn-text">{{ isSyncing ? 'Syncing...' : 'Fetch Live' }}</span>
          </button>

          <button class="btn-outline btn-sm" @click="$emit('open-csv')">
            <Upload :size="15" />
            <span class="btn-text">Import</span>
          </button>
        </div>

        <!-- Mobile Drawer Toggle Hamburger Button -->
        <button class="mobile-drawer-toggle" @click="isDrawerOpen = true" aria-label="Open Navigation Menu">
          <Menu :size="24" class="text-cyan" />
        </button>
      </div>
    </div>

    <!-- Desktop Active Navigation Tabs Slider -->
    <nav class="nav-tabs-container desktop-only">
      <div class="nav-tabs font-heading" ref="tabsContainerRef">
        <button 
          v-for="tab in tabs" 
          :key="tab.id" 
          :class="['nav-btn', { active: activeTab === tab.id }]"
          @click="selectTab(tab.id)"
        >
          <component :is="tab.icon" :size="17" class="tab-icon" />
          <span>{{ tab.label }}</span>
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </button>
      </div>
    </nav>

    <!-- MOBILE SLIDE-OUT NAVIGATION DRAWER -->
    <Teleport to="body">
      <transition name="drawer-fade">
        <div v-if="isDrawerOpen" class="mobile-drawer-overlay" @click.self="isDrawerOpen = false">
          <div class="mobile-drawer-panel glass-panel">
            <div class="drawer-header">
              <div class="logo-box">
                <Activity class="logo-icon text-cyan" :size="24" />
                <h2 class="logo-title">SportPulse <span class="text-gradient-cyan">AI</span></h2>
              </div>
              <button class="btn-close-drawer" @click="isDrawerOpen = false" aria-label="Close Menu">
                <X :size="22" />
              </button>
            </div>

            <div class="drawer-body">
              <p class="drawer-section-title font-mono">NAVIGATION MENU</p>
              <nav class="drawer-nav font-heading">
                <button 
                  v-for="tab in tabs" 
                  :key="tab.id" 
                  :class="['drawer-nav-btn', { active: activeTab === tab.id }]"
                  @click="selectTab(tab.id)"
                >
                  <div class="drawer-btn-left">
                    <component :is="tab.icon" :size="19" class="drawer-icon" />
                    <span>{{ tab.label }}</span>
                  </div>
                  <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
                </button>
              </nav>

              <div class="drawer-actions-box">
                <p class="drawer-section-title font-mono">DATA ACTIONS</p>
                <button class="btn-primary drawer-action-btn" @click="triggerLiveAndClose" :disabled="isSyncing">
                  <RefreshCw :size="16" :class="{ 'spin-icon': isSyncing }" />
                  <span>{{ isSyncing ? 'Syncing...' : 'Fetch Live Data' }}</span>
                </button>

                <button class="btn-outline drawer-action-btn" @click="triggerCsvAndClose">
                  <Upload :size="16" />
                  <span>Import Custom CSV</span>
                </button>
              </div>
            </div>

            <div class="drawer-footer font-mono text-muted">
              <span>Model Contract: <strong>v2.8-COLDSTART</strong></span>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </header>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { Activity, LayoutDashboard, Calendar, History, GitBranch, Cpu, TrendingUp, BarChart2, RefreshCw, Upload, Menu, X } from 'lucide-vue-next';

const props = defineProps({
  activeTab: { type: String, default: 'upcoming' },
  cutoffDate: { type: String, default: '2026-08-16' },
  isSyncing: { type: Boolean, default: false }
});

const emit = defineEmits(['select-tab', 'open-csv', 'fetch-live']);

const tabsContainerRef = ref(null);
const isDrawerOpen = ref(false);

const tabs = [
  { id: 'upcoming', label: 'Upcoming Fixtures', icon: Calendar, badge: 'Real APIs' },
  { id: 'pastmatches', label: 'Past Match Audit', icon: History, badge: 'Pre-Match' },
  { id: 'analytics', label: 'Performance Analytics', icon: BarChart2, badge: 'Step 32' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'walkforward', label: 'Walk-Forward Lab', icon: GitBranch },
  { id: 'montecarlo', label: '10k Simulator', icon: Cpu },
  { id: 'valuebets', label: 'Market Reference', icon: TrendingUp }
];

function selectTab(tabId) {
  emit('select-tab', tabId);
  isDrawerOpen.value = false;
}

function triggerLiveAndClose() {
  emit('fetch-live');
  isDrawerOpen.value = false;
}

function triggerCsvAndClose() {
  emit('open-csv');
  isDrawerOpen.value = false;
}

// Auto-scroll active tab into view on mobile
watch(() => props.activeTab, async () => {
  await nextTick();
  if (tabsContainerRef.value) {
    const activeEl = tabsContainerRef.value.querySelector('.nav-btn.active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }
});
</script>

<style scoped>
.header-nav {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 20px;
  border-radius: var(--radius-md);
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
}

.logo-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.text-cyan {
  color: var(--primary-cyan);
}

.logo-title {
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.logo-subtitle {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.desktop-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-drawer-toggle {
  display: none;
  background: rgba(0, 242, 254, 0.1);
  border: 1px solid rgba(0, 242, 254, 0.25);
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.mobile-drawer-toggle:hover {
  background: rgba(0, 242, 254, 0.2);
}

.btn-sm {
  padding: 7px 14px;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  font-family: var(--font-heading);
  font-weight: 600;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Nav Tabs Slider Container */
.nav-tabs-container {
  width: 100%;
  overflow: hidden;
}

.nav-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(7, 11, 18, 0.7);
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

.nav-tabs::-webkit-scrollbar {
  display: none;
}
.nav-tabs {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.nav-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: 8px 14px;
  border-radius: 7px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.05);
}

.nav-btn.active {
  background: rgba(0, 242, 254, 0.12);
  color: var(--primary-cyan);
  border-color: rgba(0, 242, 254, 0.3);
  box-shadow: 0 0 12px rgba(0, 242, 254, 0.15);
}

.tab-badge {
  background: rgba(0, 242, 254, 0.18);
  color: var(--primary-cyan);
  font-size: 0.68rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
}

/* MOBILE DRAWER OVERLAY STYLES */
.mobile-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 11, 18, 0.75);
  backdrop-filter: blur(10px);
  z-index: 9999;
  display: flex;
  justify-content: flex-end;
}

.mobile-drawer-panel {
  width: 300px;
  max-width: 85vw;
  height: 100%;
  background: rgba(15, 23, 42, 0.95);
  border-left: 1px solid var(--border-color);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.btn-close-drawer {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--text-main);
  }
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex-grow: 1;
}

.drawer-section-title {
  font-size: 0.72rem;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-nav-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  transition: all 0.2s ease;
}

.drawer-btn-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
}

.drawer-nav-btn.active {
  background: rgba(0, 242, 254, 0.12);
  color: var(--primary-cyan);
  border-color: rgba(0, 242, 254, 0.3);
  box-shadow: 0 0 12px rgba(0, 242, 254, 0.15);
}

.drawer-actions-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.drawer-action-btn {
  width: 100%;
  justify-content: center;
  padding: 10px;
  font-size: 0.88rem;
}

.drawer-footer {
  font-size: 0.75rem;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  text-align: center;
}

/* TRANSITIONS */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-active .mobile-drawer-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-fade-leave-active .mobile-drawer-panel {
  transition: transform 0.25s ease-in;
}

.drawer-fade-enter-from .mobile-drawer-panel {
  transform: translateX(100%);
}

.drawer-fade-leave-to .mobile-drawer-panel {
  transform: translateX(100%);
}

/* Mobile & Tablet Responsiveness */
@media (max-width: 768px) {
  .header-nav {
    padding: 12px 14px;
    gap: 10px;
    margin-bottom: 16px;
  }

  .desktop-actions {
    display: none;
  }

  .mobile-drawer-toggle {
    display: flex;
  }

  .logo-title {
    font-size: 1.15rem;
  }

  .logo-subtitle {
    font-size: 0.62rem;
  }

  .desktop-only {
    display: none;
  }
}

@media (max-width: 480px) {
  .logo-subtitle {
    display: none;
  }
}
</style>
