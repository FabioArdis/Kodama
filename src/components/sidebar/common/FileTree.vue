<script>
export default {
  name: "FileTree",
  props: {
    files: {
      type: Array,
      required: true
    },
    getFileIcon: {
      type: Function,
      required: true
    },
    openFile: {
      type: Function,
      required: true
    }
  }
};
</script>

<template>
  <div>
    <div v-for="file in files" :key="file.path">
      <div
        @click="openFile(file)"
        class="px-2 py-1 hover:bg-primary rounded cursor-pointer flex items-center select-none"
      >
        <i :class="`fas ${getFileIcon(file)} mr-2`"></i>
        <span class="truncate text-xs">{{ file.name }}</span>
      </div>
      
      <div v-if="file.isDirectory && file.expanded" class="pl-4 mt-1">
        <file-tree
          :files="file.children"
          :get-file-icon="getFileIcon"
          :open-file="openFile"
        />
      </div>
    </div>
  </div>
</template>