import { ref, computed } from 'vue'
import { useGroupsStore } from '@/stores/groups'

const selectedGroupId = ref<string>('')

export function useSelectedGroup() {
  const groupsStore = useGroupsStore()

  const currentGroupId = computed({
    get: () => {
      if (selectedGroupId.value) return selectedGroupId.value
      const stored = localStorage.getItem('selected_group_id')
      if (stored) {
        selectedGroupId.value = stored
        return stored
      }
      if (groupsStore.groups.length > 0) {
        return groupsStore.groups[0].id
      }
      return ''
    },
    set: (value: string) => {
      selectedGroupId.value = value
      localStorage.setItem('selected_group_id', value)
    }
  })

  const currentGroup = computed(() => {
    return groupsStore.groups.find(g => g.id === currentGroupId.value)
  })

  const hasGroup = computed(() => {
    return groupsStore.groups.length > 0
  })

  return {
    currentGroupId,
    currentGroup,
    hasGroup
  }
}
