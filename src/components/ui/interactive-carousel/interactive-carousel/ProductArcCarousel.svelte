<script>
  import ProductSpatialGallery from './ProductSpatialGallery.svelte';
  export let images = [];
  export let alt = '';
</script>

<ProductSpatialGallery {images} {alt} variant="arc" />
