<template>
  <div class="sensor-image-container" v-if="imageSrc">
    <img :src="imageSrc" :alt="altText" class="sensor-image" />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  image: String,
  altText: {
    type: String,
    default: 'Sensor image'
  }
});

// Compute the full image source path
const imageSrc = computed(() => {
  if (props.image) {
    // Prepend the base URL if the image path is relative
    if (props.image.startsWith('http')) {
      return props.image;
    } else {
      return `${import.meta.env.BASE_URL}${props.image}`;
    }
  }
  return null;
});
</script>

<style scoped>
.sensor-image-container {
  display: flex;
  justify-content: center;
  margin: -10px 0;
}

.sensor-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 8px;
}

@media (max-width: 600px) {
  .sensor-image {
    max-height: 150px;
  }
}
</style>
