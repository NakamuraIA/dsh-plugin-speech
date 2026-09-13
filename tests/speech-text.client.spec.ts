/** Read-aloud projection: what the voice says, and what it must never say. */
import { describe, expect, it } from 'vitest'
import { speechText } from '../src/speech-text.ts'

/** Project with code reading on, the way the settings default does. */
const spoken = (markdown: string): string => speechText(markdown, { skipCode: true })

describe('speechText', () => {
  it('keeps prose and sentence punctuation', () => {
    expect(spoken('Olá, mundo! Tudo bem? Sim; obrigado: até logo.'))
      .toBe('Olá, mundo! Tudo bem? Sim; obrigado: até logo.')
  })

  it('drops fenced code and inline code when code is skipped', () => {
    expect(spoken('Antes\n```js\nconst x = 1\n```\ndepois `inline` fim')).toBe('Antes\ndepois fim')
  })

  it('keeps code words when the reader asked to read code', () => {
    const text = speechText('Antes\n```js\nconst x = 1\n```\ndepois `inline` fim', { skipCode: false })
    // The code's words survive; its standalone symbols still do not, because a
    // lone `=` is exactly what the projection exists to keep out of the voice.
    expect(text).toContain('const x')
    expect(text).toContain('inline')
    expect(text).not.toContain('```')
    expect(text).not.toContain('=')
  })

  it('drops tables, separators, and pasted sheets in every mode', () => {
    const table = ['| Coluna | Outra |', '| --- | --- |', '| dado | dado |'].join('\n')
    expect(spoken(`Antes\n${table}\nDepois`)).toBe('Antes\nDepois')
    expect(speechText(`Antes\n${table}\nDepois`, { skipCode: false })).toBe('Antes\nDepois')
    expect(spoken('Antes\nnome\tidade\tcidade\tpais\nDepois')).toBe('Antes\nDepois')
  })

  it('keeps a link label and removes its target, and removes images whole', () => {
    expect(spoken('Veja o [guia completo](https://exemplo.com/a?b=1) agora'))
      .toBe('Veja o guia completo agora')
    expect(spoken('Veja [a referência][ref] agora')).toBe('Veja a referência agora')
    expect(spoken('Antes ![foto](imagem.png) depois')).toBe('Antes depois')
  })

  it('removes bare URLs, HTML tags, and autolinks', () => {
    expect(spoken('Vá em https://exemplo.com/x e www.exemplo.com agora')).toBe('Vá em e agora')
    expect(spoken('Texto <b>negrito</b> e <https://exemplo.com> fim')).toBe('Texto negrito e fim')
  })

  it('removes footnote markers and leftover empty pairs', () => {
    expect(spoken('Frase com nota[1] e outra[^2] aqui')).toBe('Frase com nota e outra aqui')
    expect(spoken('Frase () e [] e {} fim')).toBe('Frase e e fim')
  })

  it('removes headings, quotes, and list markers', () => {
    expect(spoken('# Título\n> citação\n- item\n1. passo')).toBe('Título\ncitação\nitem\npasso')
  })

  it('removes emphasis without breaking a math operator between digits', () => {
    expect(spoken('Texto **forte** e *ênfase* e ~~riscado~~.')).toBe('Texto forte e ênfase e riscado.')
    expect(spoken('Então ***por aqui***.')).toBe('Então por aqui.')
    expect(spoken('Multiplique 2*3 agora')).toBe('Multiplique 2*3 agora')
  })

  it('removes emoji, flags, skin tones, and joiners', () => {
    expect(spoken('Bom dia 🎉🇧🇷👍🏽👨‍👩‍👧 fim')).toBe('Bom dia fim')
  })

  it('removes quotation marks of both families', () => {
    expect(spoken('Ele disse "olá" e \'tchau\' e «isto» e “aquilo” fim'))
      .toBe('Ele disse olá e tchau e isto e aquilo fim')
  })

  it('drops standalone symbols but keeps them attached to a number', () => {
    expect(spoken('Marcadores - @ $ % & / \\ | ~ ^ fim')).toBe('Marcadores fim')
    expect(spoken('Cresceu 42% e custou R$ 10,00')).toBe('Cresceu 42% e custou R$ 10,00')
  })

  it('normalizes line endings and collapses blank lines', () => {
    expect(spoken('Um\r\n\r\nDois\r\n')).toBe('Um\nDois')
  })

  it('returns empty text when nothing is speakable', () => {
    expect(spoken('```js\nconst x = 1\n```')).toBe('')
    expect(spoken('--- *** ---')).toBe('')
    expect(speechText('', { skipCode: true })).toBe('')
  })
})
