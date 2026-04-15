/**
 * Rimuove i `<mark data-highlight>` precedentemente inseriti nel container,
 * sostituendoli col testo originale.
 */
export function clearHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll<HTMLElement>('mark[data-highlight]')
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
  })
  container.normalize()
}

/**
 * Walk dei text node del container; per ogni highlight string cerca la prima
 * occorrenza (whitespace-insensitive) e la wrappa in uno o più
 * <mark data-highlight data-highlight-index=i>. Selezioni che attraversano
 * più text node (es. multi-paragrafo) producono più <mark> con lo stesso
 * data-highlight-index: è corretto, evita HTML invalido (p dentro mark).
 */
export function applyHighlights(container: HTMLElement, highlights: string[]): void {
  clearHighlights(container)
  highlights.forEach((text, index) => wrapFirstMatch(container, text, index))
}

export function scrollToHighlight(container: HTMLElement, index: number): void {
  const marks = container.querySelectorAll<HTMLElement>(
    `mark[data-highlight-index="${index}"]`
  )
  if (marks.length === 0) return
  marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
  marks.forEach((m) => m.classList.add('flash'))
  window.setTimeout(() => marks.forEach((m) => m.classList.remove('flash')), 1400)
}

function wrapFirstMatch(container: HTMLElement, target: string, index: number): void {
  const normalizedTarget = target.replace(/\s+/g, ' ').trim()
  if (!normalizedTarget) return

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('mark[data-highlight]')) return NodeFilter.FILTER_REJECT
      if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes: Text[] = []
  let current: Node | null = walker.nextNode()
  while (current) {
    textNodes.push(current as Text)
    current = walker.nextNode()
  }

  const fullText = textNodes.map((n) => n.data).join('')
  const normalizedFull = fullText.replace(/\s+/g, ' ')

  const matchNorm = normalizedFull.indexOf(normalizedTarget)
  if (matchNorm === -1) return

  const mapping = buildIndexMapping(fullText)
  const startRaw = mapping[matchNorm]
  const endRaw = mapping[matchNorm + normalizedTarget.length - 1] + 1
  if (startRaw === undefined || endRaw === undefined) return

  // Calcola gli overlap prima di modificare il DOM (evitiamo invalidare gli offset)
  const segments: { node: Text; from: number; to: number }[] = []
  let running = 0
  for (const node of textNodes) {
    const nodeStart = running
    const nodeEnd = running + node.data.length
    running = nodeEnd
    const overlapStart = Math.max(startRaw, nodeStart)
    const overlapEnd = Math.min(endRaw, nodeEnd)
    if (overlapStart >= overlapEnd) continue
    segments.push({
      node,
      from: overlapStart - nodeStart,
      to: overlapEnd - nodeStart
    })
  }

  for (const { node, from, to } of segments) {
    let seg = node
    if (from > 0) seg = seg.splitText(from)
    const segLen = to - from
    if (segLen < seg.data.length) seg.splitText(segLen)
    const mark = document.createElement('mark')
    mark.setAttribute('data-highlight', 'true')
    mark.setAttribute('data-highlight-index', String(index))
    const parent = seg.parentNode
    if (!parent) continue
    parent.insertBefore(mark, seg)
    mark.appendChild(seg)
  }
}

function buildIndexMapping(full: string): number[] {
  const out: number[] = []
  let prevWasSpace = false
  for (let i = 0; i < full.length; i++) {
    const isSpace = /\s/.test(full[i])
    if (isSpace) {
      if (!prevWasSpace) out.push(i)
      prevWasSpace = true
    } else {
      out.push(i)
      prevWasSpace = false
    }
  }
  return out
}
