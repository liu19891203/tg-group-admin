import { ref, nextTick } from 'vue'

/**
 * 在 textarea 光标位置插入文本
 * @returns textareaRef - 绑定到 el-input 的 ref
 * @returns insertAtCursor - 在光标位置插入文本的函数
 */
export function useTextareaInsert() {
  const textareaRef = ref<any>(null)

  const insertAtCursor = (
    text: string,
    currentValue: string,
    onUpdate: (newValue: string) => void
  ) => {
    const textarea = textareaRef.value?.$el?.querySelector('textarea')
    
    if (!textarea) {
      // 如果无法获取 textarea，直接追加到末尾
      onUpdate(currentValue + text)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    // 在光标位置插入文本
    const newText = currentValue.substring(0, start) + text + currentValue.substring(end)
    onUpdate(newText)

    // 设置新的光标位置（在插入的文本之后）
    nextTick(() => {
      const newCursorPos = start + text.length
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
  }

  return {
    textareaRef,
    insertAtCursor
  }
}
