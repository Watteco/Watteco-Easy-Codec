<template>
  <div class="language-switcher">
    <button 
      v-for="lang in availableLanguages" 
      :key="lang.code"
      @click="$emit('update:language', lang.code)"
      class="flag-button"
      :class="{ active: currentLanguage === lang.code }"
    >
      <img 
        :src="lang.flag" 
        :alt="lang.name" 
        class="flag-icon" 
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import gbFlag from '@/assets/img/flags/gb.png';
import frFlag from '@/assets/img/flags/fr.png';

// Props
defineProps({
  currentLanguage: {
    type: String,
    required: true
  }
});

// Emits
defineEmits(['update:language']);

const availableLanguages = [
  { code: 'en', name: 'English', flag: gbFlag },
  { code: 'fr', name: 'Français', flag: frFlag }
];
</script>

<style scoped>
.language-switcher {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 4px;
  background: var(--ion-color-darkGrey);
  padding: 4px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.flag-button {
  background: none;
  border: none;
  padding: 2px;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.2s;
  opacity: 0.6;
}

.flag-button:hover {
  transform: scale(1.1);
  opacity: 0.8;
}

.flag-button.active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.flag-icon {
  width: 24px;
  height: 18px;
  object-fit: cover;
  border-radius: 2px;
  display: block;
  margin: 0 5px;
}

@media (max-width: 600px) {
  .language-switcher {
    bottom: 8px;
    right: 8px;
    padding: 2px;
  }

  .flag-icon {
    width: 20px;
    height: 15px;
  }
}
</style>
