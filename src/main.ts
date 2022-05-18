import '@logseq/libs'
import { BlockEntity, BlockUUIDTuple } from '@logseq/libs/dist/LSPlugin'
import * as d3 from 'd3'
import hotkeys from 'hotkeys-js'
import { INode } from 'markmap-common'
import { Transformer } from 'markmap-lib/dist/browser'
import * as markmap from 'markmap-view'
import { Markmap } from 'markmap-view'
import org from 'org'
import replaceAsync from 'string-replace-async'
import ellipsis from 'text-ellipsis'
import TurndownService from 'turndown'
import { createApp } from 'vue'
import App from './App.vue'
import {
  addToolbar,
  closeButtonHandler,
  eventFire,
  getSettings,
  goBackButtonHandler,
  goForwardButtonHandler,
  hexToRgb,
  initSettings,
  pickTextColorBasedOnBgColorSimple,
  themeWorkflowTag,
  walkTransformBlocksFilter,
} from './funcs'
import './style.css'

const transformer = new Transformer()

let renderAsBlock = false
let editingBlockUUID = ''

const triggerMarkmap = async ({ uuid }) => {
  const blocks = await logseq.Editor.getSelectedBlocks()
  const editing = await logseq.Editor.checkEditing()

  if (uuid && (editing || (blocks && blocks.length > 0))) {
    editingBlockUUID = uuid
    createModel().openMindMap(true)
  } else {
    createModel().openMindMap(false)
  }
}

const triggerMarkmapForceBlock = async ({ uuid }) => {
  editingBlockUUID = uuid
  createModel().openMindMap(true)
}

/**
 * User model
 */
function createModel() {
  return {
    openMindMap(blockMode = false) {
      // @ts-ignore
      Alpine.store('showHelp').close()

      const closeButton = document.getElementById('close-button')
      closeButton.removeEventListener('click', closeButtonHandler, false)
      closeButton.addEventListener('click', closeButtonHandler, false)

      const goBackButton = document.getElementById('go-back-button')
      goBackButton.removeEventListener('click', goBackButtonHandler, false)
      goBackButton.addEventListener('click', goBackButtonHandler, false)

      const goForwardButton = document.getElementById('go-forward-button')
      goForwardButton.removeEventListener(
        'click',
        goForwardButtonHandler,
        false
      )
      goForwardButton.addEventListener('click', goForwardButtonHandler, false)

      if (blockMode === true || blockMode === false) {
        renderAsBlock = blockMode
      } else {
        renderAsBlock = false
      }
      logseq.showMainUI({
        autoFocus: true,
      })
    },
  }
}

async function main() {
  initSettings()
  const keyBindings = getSettings('keyBindings')

  // Set Model Style
  logseq.setMainUIInlineStyle({
    position: 'fixed',
    zIndex: 12,
  })

  logseq.App.registerCommandPalette(
    {
      key: 'mark-map-open',
      label: 'Open Markmap',
      keybinding: {
        mode: 'global',
        binding: keyBindings.openMarkmap,
      },
    },
    triggerMarkmap
  )
  logseq.Editor.registerSlashCommand('Markmap', triggerMarkmapForceBlock)
  logseq.Editor.registerBlockContextMenuItem(
    `Markmap`,
    triggerMarkmapForceBlock
  )

  // Register icon ui
  logseq.App.registerUIItem('pagebar', {
    key: 'logseq-mark-map',
    template: `
     <a class="button" data-on-click="openMindMap" title="Open mindmap mode">
      <svg t="1627350023942" class="icon h-5 w-5" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="670"><path d="M840.533333 490.666667l-17.066666-85.333334L554.666667 460.8V170.666667h-85.333334v262.4l-296.533333-192-46.933333 72.533333 324.266666 209.066667L200.533333 849.066667l68.266667 51.2 241.066667-315.733334 179.2 270.933334 72.533333-46.933334-179.2-266.666666z" fill="#CFD8DC" p-id="671"></path><path d="M512 512m-149.333333 0a149.333333 149.333333 0 1 0 298.666666 0 149.333333 149.333333 0 1 0-298.666666 0Z" fill="#C435F3" p-id="672" data-spm-anchor-id="a313x.7781069.0.i0" class=""></path><path d="M512 170.666667m-106.666667 0a106.666667 106.666667 0 1 0 213.333334 0 106.666667 106.666667 0 1 0-213.333334 0Z" fill="#F48233" p-id="673" data-spm-anchor-id="a313x.7781069.0.i4" class="selected"></path><path d="M832 448m-106.666667 0a106.666667 106.666667 0 1 0 213.333334 0 106.666667 106.666667 0 1 0-213.333334 0Z" fill="#F48233" p-id="674" data-spm-anchor-id="a313x.7781069.0.i5" class="selected"></path><path d="M149.333333 277.333333m-106.666666 0a106.666667 106.666667 0 1 0 213.333333 0 106.666667 106.666667 0 1 0-213.333333 0Z" fill="#F48233" p-id="675" data-spm-anchor-id="a313x.7781069.0.i3" class="selected"></path><path d="M234.666667 874.666667m-106.666667 0a106.666667 106.666667 0 1 0 213.333333 0 106.666667 106.666667 0 1 0-213.333333 0Z" fill="#F48233" p-id="676" data-spm-anchor-id="a313x.7781069.0.i7" class="selected"></path><path d="M725.333333 832m-106.666666 0a106.666667 106.666667 0 1 0 213.333333 0 106.666667 106.666667 0 1 0-213.333333 0Z" fill="#F48233" p-id="677" data-spm-anchor-id="a313x.7781069.0.i6" class="selected"></path></svg>
     </a>
    `,
  })

  const convertFlatBlocksToTree = async (
    blocks: (BlockUUIDTuple | BlockEntity)[]
  ): Promise<BlockEntity[]> => {
    const children = []
    if (blocks && blocks.length > 0) {
      for (const item of blocks) {
        if (Array.isArray(item)) {
          if (!item[1]) {
            continue
          }
          const block = await logseq.Editor.getBlock(item[1], {
            includeChildren: true,
          })
          if (block && block.children && block.children.length > 0) {
            block.children = await convertFlatBlocksToTree(
              block.children as BlockUUIDTuple[]
            )
          }
          children.push(block)
        } else {
          children.push(item)
        }
      }
    }

    return children
  }

  let mm: Markmap
  let currentLevel: number
  let totalLevel: number
  let originalRoot: INode
  let originalTotalLevel: number

  let config = await logseq.App.getUserConfigs()

  // reload config if graph change
  logseq.App.onCurrentGraphChanged(async () => {
    config = await logseq.App.getUserConfigs()
  })

  const defaultLinkRender = transformer.md.renderer.rules.link_open
  transformer.md.inline.ruler.enable(['mark'])
  transformer.md.renderer.rules.link_open = function (
    tokens,
    idx: number,
    ...args: []
  ) {
    let result = defaultLinkRender(tokens, idx, ...args)

    if (tokens[idx] && tokens[idx].href) {
      result = result.replace('>', ' target="_blank">')
    }

    return result
  }

  const matchAttr = (s: string) => {
    const r = /\b(\w+)\s*=\s*"(.*?)"/g
    const d: any = {}

    // ...  this loop will run indefinitely!
    let m = r.exec(s)
    while (m) {
      d[m[1]] = m[2]
      m = r.exec(s)
    }

    return d
  }

  const defaultImageRender = transformer.md.renderer.rules.image
  transformer.md.renderer.rules.image = function (
    tokens,
    idx: number,
    ...args: []
  ) {
    let result = defaultImageRender(tokens, idx, ...args)
    const attr = matchAttr(result)
    let src = attr.src || attr.href
    const alt = attr.alt || attr.title || ''

    // For now just support MacOS/Linux，Need to test and fix on Windows.
    if (src.indexOf('http') !== 0 && src.indexOf('..') === 0) {
      src = config.currentGraph.substring(13) + '/' + src.replace(/\.\.\//g, '')
    }

    if (['pdf'].includes(src.substring(src.lastIndexOf('.') + 1))) {
      result = `📄 ${alt}`
    } else {
      result = `<a target="_blank" title="${alt}"  data-lightbox="gallery" href="${src}">🖼 ${alt}</a>`
    }

    return result
  }

  let uiVisible = false
  logseq.App.onRouteChanged(async () => {
    if (uiVisible) {
      await renderMarkmap()
    }
  })

  const renderMarkmap = async () => {
    let blocks = await logseq.Editor.getCurrentPageBlocksTree()
    const page = (await logseq.Editor.getCurrentPage()) as any

    let title
    if (renderAsBlock) {
      let currentBlock
      if (editingBlockUUID) {
        currentBlock = await logseq.Editor.getBlock(editingBlockUUID, {
          includeChildren: true,
        })
      } else {
        currentBlock = await logseq.Editor.getCurrentBlock()
      }

      if (currentBlock) {
        let content = currentBlock.content
        content = content
          ? content
              .split('\n')
              .filter((line: string) => line.indexOf(':: ') === -1)
              .join('\n')
              .replace(/^[#\s]+/, '')
              .trim()
          : ''
        title = content
        blocks = await convertFlatBlocksToTree(currentBlock?.children)
      }
    } else {
      title = page?.properties?.markMapTitle || page?.originalName || page?.name
    }

    // For block page
    if (page && !page.originalName && page.content) {
      let content = page.content
      content = content
        ? content
            .split('\n')
            .filter((line: string) => line.indexOf('::') === -1)
            .join('\n')
            .replace(/^[#\s]+/, '')
            .trim()
        : ''
      title = content
      blocks = await convertFlatBlocksToTree(page?.children)
    }

    const collapsed = page?.properties?.markMapCollapsed

    // Build markdown
    currentLevel = -1 // reset level;

    let filteredBlocks = await walkTransformBlocksFilter(blocks)
    if (
      page?.properties?.markMapLimitAll &&
      filteredBlocks.length > page?.properties?.markMapLimitAll
    ) {
      const limitBlocks = filteredBlocks.splice(
        0,
        page?.properties?.markMapLimitAll
      )
      filteredBlocks = limitBlocks.concat({
        content: '...',
        properties: { collapsed: true },
        children: filteredBlocks,
      })
    } else if (
      page?.properties?.markMapLimit &&
      filteredBlocks.length > page?.properties?.markMapLimit
    ) {
      const limitBlocks = filteredBlocks.splice(
        0,
        page?.properties?.markMapLimit
      )
      filteredBlocks = limitBlocks.concat({
        content: '...',
        properties: { collapsed: true },
        children: filteredBlocks,
      })
    }

    const walkTransformBlocksLimit = (blocks: any, limit = 0) => {
      if (limit && blocks && blocks.length > limit) {
        const limitBlocks = blocks.splice(0, limit)
        blocks = limitBlocks.concat({
          content: '...',
          properties: { collapsed: true },
          children: blocks,
        })
      }

      if (blocks && blocks.length > 0) {
        for (const it of blocks) {
          //content
          const { children, properties } = it
          if (children) {
            it.children = walkTransformBlocksLimit(
              children,
              page?.properties?.markMapLimitAll || properties?.markMapLimit
            )
          }
        }
      }

      return blocks
    }

    filteredBlocks = walkTransformBlocksLimit(filteredBlocks)

    // iterate blocks
    const walkTransformBlocks = async (
      blocks: any,
      depth = 0,
      config = {}
    ): Promise<string[]> => {
      currentLevel = Math.min(5, Math.max(currentLevel, depth))
      totalLevel = Math.min(5, Math.max(currentLevel, depth))

      if (!blocks) {
        return []
      }

      const newBlocks = []
      for (const it of blocks) {
        // uuid, title,
        const { children, content, properties } = it

        const contentFiltered = content
          .split('\n')
          .filter((line: string) => line.indexOf(':: ') === -1)
          .join('\n')
        let topic = contentFiltered

        // Process #+BEGIN_WARNING, #+BEGIN_NOTE, #+BEGIN_TIP

        const regexHashWarning = /#\+BEGIN_WARNING([\s\S]*?)#\+END_WARNING/im
        const regexHashNote = /#\+BEGIN_NOTE([\s\S]*?)#\+END_NOTE/im
        const regexHashTip = /#\+BEGIN_TIP([\s\S]*?)#\+END_TIP/im
        if (regexHashWarning.test(topic)) {
          topic = topic.replace(regexHashWarning, (match, p1) => {
            return `⚠️ ${p1.trim()}`
          })
        } else if (regexHashNote.test(topic)) {
          topic = topic.replace(regexHashNote, (match, p1) => {
            return `ℹ️ ${p1.trim()}`
          })
        } else if (regexHashTip.test(topic)) {
          topic = topic.replace(regexHashTip, (match, p1) => {
            return `💡 ${p1.trim()}`
          })
        }

        // transform renderer to specials style
        topic = topic.replace(/{{renderer.*?}}/g, `✨ Renderer`)

        // Process page tag
        const regexPageTag = /\s+#([^#\s()]+)/gi
        if (regexPageTag.test(topic)) {
          topic = topic.replace(regexPageTag, (match, p1) => {
            return ` <a style="cursor: pointer; font-size: 60%; vertical-align:middle;" target="_blank" onclick="logseq.App.pushState('page', { name: '${p1}' }); logseq.hideMainUI(); logseq.showMainUI();">#${p1}</a>`
          })
        }

        if (topic) {
          // Theme workflow tag
          topic = themeWorkflowTag(topic)
        }

        // process link block reference
        const regexLinkBlockRef =
          /\[(.*?)\]\(\(\(([0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})\)\)\)/gi
        if (regexLinkBlockRef.test(topic)) {
          topic = await replaceAsync(
            topic,
            regexLinkBlockRef,
            async (match, p1, p2) => {
              const block = await logseq.Editor.getBlock(p2)
              return `<a style="cursor: pointer" target="_blank" onclick="logseq.App.pushState('page', { name: '${block.uuid}' }); logseq.hideMainUI(); logseq.showMainUI();">${p1}</a>`
            }
          )
        }

        // process link page reference
        const regexLinkPageRef = /\[(.*?)\]\(\[\[(.*?)\]\]\)/gi
        if (regexLinkPageRef.test(topic)) {
          topic = await replaceAsync(
            topic,
            regexLinkPageRef,
            async (match, p1, p2) => {
              return `<a style="cursor: pointer" target="_blank" onclick="logseq.App.pushState('page', { name: '${p2}' }); logseq.hideMainUI(); logseq.showMainUI();">${p1}</a>`
            }
          )
        }

        // Process block reference
        const regexBlockRef =
          /\(\(([0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})\)\)/gi
        const regexEmbedBlockRef =
          /\{\{embed\s+\(\(([0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})\)\)\}\}/gi
        if (regexEmbedBlockRef.test(topic)) {
          topic = await replaceAsync(
            topic,
            regexEmbedBlockRef,
            async (match, p1) => {
              const block = await logseq.Editor.getBlock(p1)
              if (block) {
                const content = block.content
                const contentFiltered = content
                  .split('\n')
                  .filter((line: string) => line.indexOf(':: ') === -1)
                  .join('\n')

                return `<a style="cursor: pointer" target="_blank" onclick="logseq.App.pushState('page', { name: '${
                  block.uuid
                }' }); logseq.hideMainUI(); logseq.showMainUI();">${themeWorkflowTag(
                  contentFiltered || '[MISSING BLOCK]'
                )}</a>`
              }
              return '[MISSING BLOCK]'
            }
          )
        }

        if (regexBlockRef.test(topic)) {
          topic = await replaceAsync(
            topic,
            regexBlockRef,
            async (match, p1) => {
              const block = await logseq.Editor.getBlock(p1)
              if (block) {
                const content = block.content
                const contentFiltered = content
                  .split('\n')
                  .filter((line: string) => line.indexOf(':: ') === -1)
                  .join('\n')
                return `<a style="cursor: pointer" target="_blank" onclick="logseq.App.pushState('page', { name: '${
                  block.uuid
                }' }); logseq.hideMainUI(); logseq.showMainUI();">${themeWorkflowTag(
                  contentFiltered || '[MISSING BLOCK]'
                )}</a>`
              }
              return '[MISSING BLOCK]'
            }
          )
        }

        // Process page reference
        const regexPageRef = /\[\[([^[\]]*?)\]\]/gi
        const regexEmbedPageRef = /\{\{embed\s+\[\[([^[\]]*?)\]\]\}\}/gi
        if (regexEmbedPageRef.test(topic)) {
          topic = topic.replace(regexEmbedPageRef, (match, p1) => {
            return `<a style="cursor: pointer" target="_blank" onclick="logseq.App.pushState('page', { name: '${p1}' }); logseq.hideMainUI(); logseq.showMainUI();">${p1}</a>`
          })
        }

        if (regexPageRef.test(topic)) {
          topic = topic.replace(regexPageRef, (match, p1) => {
            return `<a style="cursor: pointer" target="_blank" onclick="logseq.App.pushState('page', { name: '${p1}' }); logseq.hideMainUI(); logseq.showMainUI();">${p1}</a>`
          })
        }

        // Process org mode
        // @ts-ignore
        if (config.preferredFormat === 'org') {
          const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
          })

          turndownService.addRule('strikethrough', {
            filter: ['del', 's', 'strike'],
            replacement: function (content) {
              return '~~' + content + '~~'
            },
          })

          const parser = new org.Parser()
          const orgDocument = parser.parse(topic)
          const orgHTMLDocument = orgDocument.convert(org.ConverterHTML, {
            headerOffset: 1,
            exportFromLineNumber: false,
            suppressSubScriptHandling: false,
            suppressAutoLink: false,
          })
          topic = orgHTMLDocument.toString() // to html
          topic = turndownService.turndown(topic) // to markdown
          topic = topic.replace(/\^\^/g, '==') // try marked syntax
        }

        // Remove leading heading syntax
        topic = topic.replace(/^[#\s]+/, '').trim()

        // Process link parse
        const regexUrl =
          /(https?:\/\/[-a-zA-Z0-9@:%_+.~#?&/=]{2,256}\.[a-z]{2,4}(\/[-a-zA-Z0-9@:%_+.~#?&/=]*)?)(?=\s)/gi
        const regexUrlMatchStartEnd =
          /^(https?:\/\/[-a-zA-Z0-9@:%_+.~#?&/=]{2,256}\.[a-z]{2,4}(\/[-a-zA-Z0-9@:%_+.~#?&/=]*)?)$/gi

        topic = topic.replace(regexUrl, '<$1>') // add <> to all links that followed by blank, means not markdown link
        topic = topic.replace(regexUrlMatchStartEnd, '<$1>') // add <> to all pure link block

        if (properties?.markMapCut) {
          const orgTopic = topic
          topic = ellipsis(topic, parseInt(properties?.markMapCut))
          topic = `<span style="cursor:pointer" title="${orgTopic}">${topic}</span>`
        }

        if (properties?.backgroundColor) {
          topic = `<span style="padding: 2px 6px; color: ${pickTextColorBasedOnBgColorSimple(
            hexToRgb(properties.backgroundColor),
            '#fff',
            '#000'
          )}; background-color:${properties.backgroundColor};">${topic}</span>`
        }

        // Optimize code block
        if (topic.indexOf('```') === 0 || topic.indexOf('- ') === 0) {
          topic = '\n' + topic
        }

        // Add leading syntax according to depth.
        let ret = (depth < 5 ? '#'.repeat(depth + 2) + ' ' : '') + topic

        if (
          children &&
          (properties?.collapsed !== true || collapsed !== 'hidden')
        ) {
          ret +=
            '\n' +
            (await walkTransformBlocks(children, depth + 1, config)).join('\n')
        }

        newBlocks.push(ret)
      }

      return newBlocks
    }

    let md =
      '# ' +
      title +
      '\n\n' +
      (await walkTransformBlocks(filteredBlocks, 0, config)).join('\n')
    md = md.replace(
      /(!\[.*?\]\(.*?\))\{(:[a-z0-9 ]+(, )?)+\}/gi,
      (match, p1) => {
        return p1
      }
    ) // remove image size

    // eslint-disable-next-line prefer-const
    let { root, features } = transformer.transform(md)

    // @ts-ignore
    root.properties = page && page.properties ? page.properties : {}

    const walkTransformRoot = (parent, blocks) => {
      if (parent.children) {
        for (const i in parent.children) {
          parent.children[i].properties = blocks[i]?.properties || {}

          // @ts-ignore
          if (
            root?.properties?.markMapCollapsed !== 'extend' &&
            parent.children[i]?.properties?.collapsed
          ) {
            parent.children[i].payload = {
              ...parent.children[i].payload,
              fold: true,
            }
          }

          walkTransformRoot(parent?.children[i], blocks[i]?.children || [])
        }
      }
    }
    walkTransformRoot(root, filteredBlocks)

    originalRoot = root
    originalTotalLevel = totalLevel
    // @ts-ignore
    window.root = root
    const { styles, scripts } = transformer.getUsedAssets(features)
    const { Markmap, loadCSS, loadJS } = markmap
    if (styles) loadCSS(styles)
    if (scripts)
      await loadJS(scripts, {
        getMarkmap: () => markmap,
      })

    // 隐藏所有子节点
    const hideAll = (target: INode) => {
      target.payload = {
        ...target.payload,
        fold: true,
      }

      target.children?.forEach((t) => {
        hideAll(t)
      })
    }

    // 显示所有子节点
    const showAll = (target: INode, depth = -1) => {
      depth++
      if (
        page?.properties?.markMapCollapsed !== 'extend' &&
        // @ts-ignore
        target?.properties?.collapsed
      ) {
        target.payload = {
          ...target.payload,
          fold: true,
        }
        currentLevel = depth
      } else {
        target.payload = {
          ...target.payload,
          fold: false,
        }
      }

      target.children?.forEach((t) => {
        showAll(t, depth)
      })
    }

    // 逐级展开
    const expandStepByStep = (target: INode): boolean => {
      let find = false
      if (target.payload?.fold && target.children) {
        target.payload.fold = false
        find = true
      }
      if (!find && target.children) {
        for (const t of target.children) {
          find = expandStepByStep(t)
          if (find) {
            return find
          }
        }
      }

      return find
    }

    const collapseStepByStep = (target: INode): boolean => {
      let find = false

      if (target.children) {
        const length = target.children.length
        for (let i = length - 1; i >= 0; i--) {
          const t = target.children[i]
          find = collapseStepByStep(t)
          if (find) {
            return find
          }
        }
      }

      if (!target.payload?.fold && target.children) {
        target.payload.fold = true
        find = true
      }
      return find
    }

    const expandLevel = (target: INode, level = 1) => {
      if (level <= 0) {
        hideAll(target)
        return
      }
      level--

      target.payload = {
        ...target.payload,
        fold: false,
      }

      target.children?.forEach((t) => {
        expandLevel(t, level)
      })
    }

    let stack: INode[] = []
    const pointerStack: number[] = []
    let pointer: number

    const focusIn = (root: INode) => {
      if (root.children) {
        pointerStack.push(pointer)
        pointer = 0
        stack.push(root)
        root = root.children[pointer]
        // @ts-ignore
        window.root = root
        showAll(root)
        mm.setData(root)
        totalLevel--
        currentLevel = totalLevel
      }
    }

    const focusOut = () => {
      if (stack.length > 0) {
        root = stack.pop() as INode
        pointer = pointerStack.pop() as number

        // @ts-ignore
        window.root = root
        showAll(root)
        mm.setData(root)

        totalLevel++
        currentLevel = totalLevel
      }
    }

    const focusNext = () => {
      const top = stack[stack.length - 1]
      if (top && top.children && pointer + 1 <= top.children.length - 1) {
        root = top.children[++pointer]
        // @ts-ignore
        window.root = root
        mm.setData(root)
      }
    }

    const focusPrevious = () => {
      const top = stack[stack.length - 1]
      if (top && top.children && pointer - 1 >= 0) {
        root = top.children[--pointer]
        // @ts-ignore
        window.root = root
        mm.setData(root)
      }
    }

    const focusReset = () => {
      root = originalRoot
      // @ts-ignore
      window.root = root
      stack = []
      showAll(root)
      mm.setData(root)
      totalLevel = originalTotalLevel
      currentLevel = totalLevel
    }

    let svgNode

    const bindKeys = async function () {
      if (hotkeys) {
        hotkeys('.', function () {
          // @ts-ignore
          const root = window.root
          focusIn(root)
          return false
        })
        hotkeys(',', function () {
          focusReset()
          return false
        })
        // @ts-ignore
        hotkeys('cmd+[', async function () {
          // @ts-ignore
          await logseq.App.invokeExternalCommand('logseq.go/backward')
          return false
        })
        // @ts-ignore
        hotkeys('cmd+]', async function () {
          // @ts-ignore
          await logseq.App.invokeExternalCommand('logseq.go/forward')
          return false
        })
        hotkeys(
          'up,down,left,right,esc,space,z,r,h,j,k,l,n,p,b,q,-,=,0,9,1,2,3,4,5,/',
          // @ts-ignore
          async function (event, handler) {
            // @ts-ignore
            const showHelp = Alpine.store('showHelp').get()

            if (showHelp && !['/', 'q', 'esc'].includes(handler.key)) {
              return
            }

            // @ts-ignore
            const jQuery = window?.jQuery
            if (jQuery) {
              if (
                jQuery('#lightboxOverlay').css('display') === 'block' &&
                !['q', 'esc'].includes(handler.key)
              ) {
                return false
              }
            }

            // @ts-ignore
            const root = window.root
            switch (handler.key) {
              case 'p': // p
                focusPrevious()
                break
              case 'n': // n
                focusNext()
                break
              case 'b': // b
                focusOut()
                break
              case '.': // .
                focusReset()
                break
              case ',': // ,
                focusIn(root)
                break
              case 'esc': // ESC
              case 'q': // q
                // @ts-ignore
                // eslint-disable-next-line no-case-declarations
                const jQuery = window?.jQuery
                // @ts-ignore
                // eslint-disable-next-line no-case-declarations
                const lightbox = window?.lightbox

                if (jQuery) {
                  if (jQuery('#lightboxOverlay').css('display') === 'block') {
                    lightbox.end()
                  }
                }
                logseq.hideMainUI({
                  restoreEditingCursor: true,
                })
                break
              case 'space': // space
                await mm?.fit()
                break
              case '0': // 0
                currentLevel = 0
                hideAll(root)
                mm.setData(root)

                break
              case '9': // 9
                currentLevel = totalLevel
                showAll(root)
                mm.setData(root)

                break
              case '1': // 1
                hideAll(root)
                expandLevel(root, 1)
                currentLevel = 1
                mm.setData(root)

                break
              case '2': // 2
                hideAll(root)
                expandLevel(root, 2)
                currentLevel = 2
                mm.setData(root)

                break
              case '3': // 3
                hideAll(root)
                expandLevel(root, 3)
                currentLevel = 3
                mm.setData(root)

                break
              case '4': // 4
                hideAll(root)
                expandLevel(root, 4)
                currentLevel = 4
                mm.setData(root)

                break
              case '5': // 5
                hideAll(root)
                expandLevel(root, 5)
                currentLevel = 5
                mm.setData(root)

                break
              case 'h': // h
                hideAll(root)
                expandLevel(root, currentLevel > 0 ? --currentLevel : 0)
                mm.setData(root)
                break
              case 'l': // l
                hideAll(root)
                expandLevel(
                  root,
                  currentLevel < totalLevel ? ++currentLevel : totalLevel
                )
                mm.setData(root)
                break

              case 'j': // j
                expandStepByStep(root)
                mm.setData(root)
                break
              case 'k': // k
                collapseStepByStep(root)
                mm.setData(root)
                break

              case '=': // +
                await mm.rescale(1.25)
                break
              case '-': // -
                await mm.rescale(0.8)
                break
              case 'z':
                // eslint-disable-next-line no-case-declarations
                const elResetButton = document.getElementById('reset-button')
                eventFire(elResetButton, 'click')
                break
              case 'r':
                // eslint-disable-next-line no-case-declarations
                const elRandomButton = document.getElementById('random-button')
                eventFire(elRandomButton, 'click')
                break
              case 'up':
                svgNode = mm.svg.node()
                if (svgNode) {
                  // @ts-ignore
                  const transform = d3.zoomTransform(mm.svg.node())
                  if (transform.x && transform.y && transform.k) {
                    // @ts-ignore
                    transform.y = transform.y - 100
                    // @ts-ignore
                    mm.transition(mm.g).attr(
                      'transform',
                      `translate(${transform.x}, ${transform.y} ) scale(${transform.k})`
                    )
                  }
                }
                break
              case 'down':
                svgNode = mm.svg.node()
                if (svgNode) {
                  // @ts-ignore
                  const transform = d3.zoomTransform(mm.svg.node())
                  if (transform.x && transform.y && transform.k) {
                    // @ts-ignore
                    transform.y = transform.y + 100
                    // @ts-ignore
                    mm.transition(mm.g).attr(
                      'transform',
                      `translate(${transform.x}, ${transform.y} ) scale(${transform.k})`
                    )
                  }
                }
                break

              case 'left':
                svgNode = mm.svg.node()
                if (svgNode) {
                  // @ts-ignore
                  const transform = d3.zoomTransform(mm.svg.node())
                  if (transform.x && transform.y && transform.k) {
                    // @ts-ignore
                    transform.x = transform.x - 100
                    // @ts-ignore
                    mm.transition(mm.g).attr(
                      'transform',
                      `translate(${transform.x}, ${transform.y} ) scale(${transform.k})`
                    )
                  }
                }
                break
              case 'right':
                svgNode = mm.svg.node()
                if (svgNode) {
                  // @ts-ignore
                  const transform = d3.zoomTransform(mm.svg.node())
                  if (transform.x && transform.y && transform.k) {
                    // @ts-ignore
                    transform.x = transform.x + 100
                    // @ts-ignore
                    mm.transition(mm.g).attr(
                      'transform',
                      `translate(${transform.x}, ${transform.y} ) scale(${transform.k})`
                    )
                  }
                }
                break

              case '/':
                // @ts-ignore
                Alpine.store('showHelp').toggle()
                break
              default:
                // console.log(handler.key);
                break
            }
            return false
          }
        )
      }
    }

    if (mm) {
      // reuse instance, update data
      showAll(root)
      mm.setData(root)
    } else {
      // initialize instance
      showAll(root)
      mm = Markmap.create(
        '#markmap',
        {
          autoFit: true,
          maxWidth: 400,
          // spacingVertical: 20,
          style(id) {
            console.log(id)
            return id
          },
        },
        root
      )

      // Only bind once
      bindKeys()

      addToolbar(mm)
    }
  }

  logseq.on('ui:visible:changed', async ({ visible }) => {
    uiVisible = visible
    if (!visible) {
      return
    }

    await renderMarkmap()
  })

  createApp(App).mount('#app')
}
logseq.ready(createModel(), main).catch(() => console.error)
