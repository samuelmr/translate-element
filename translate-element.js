class TranslateElement extends HTMLElement {

  static observedAttributes = ["current", "default"];

  constructor() {
    super();
    this.defaultLanguage = 'en'
    this.previousLanguage = this.defaultLanguage
    this.translationFile = null
    this.langAttribute = 'lang'
    this.classSelector = 'translate-element'
    this.langQueryParameter = 'lang'
    this.currentLanguage = this.defaultLanguage
    this.root = document.querySelector(':root')
    this.languages = {}
    this.listeners = [
      'animationcancel', 'animationend', 'animationiteration', 'animationstart',
      'audioprocess', 'canplay', 'canplaythrough', 'complete',
      'auxclick', 'beforeinput', 'blur', 'change', 'click', 'close', 
      'compositionend', 'compositionstart', 'compositionupdate', 
      'contentvisibilityautostatechange', 'contextmenu',
      'copy', 'cuechange', 'cut', 'dblclick', 'drag', 'dragend', 'dragenter',
      'dragexit', 'dragleave', 'dragover', 'dragstart', 'drop', 'durationchange',
      'emptied', 'ended', 'error', 'focus', 'focusin', 'focusout', 
      'fullscreenchange', 'fullscreenerror', 'gotpointercapture', 'input', 'keydown',
      'keypress', 'keyup', 'load', 'loadeddata', 'loadedmetadata', 'loadend', 'loadstart',
      'lostpointercapture', 'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout',
      'mouseover', 'mouseup', 'paste', 'pause', 'pointercancel', 'pointerdown', 
      'pointerenter', 'pointerleave', 'pointermove', 'pointerout', 'pointerover', 'pointerup', 
      'play', 'playing', 'progress', 'ratechange', 'reset', 'resize', 'scroll', 'scrollend',
      'securitypolicyviolation', 'seeked', 'seeking', 'stalled', 'suspend', 'timeupdate',
      'touchcancel', 'touchend', 'touchmove', 'touchstart',
      'transitioncancel', 'transitionend', 'transitionrun', 'transitionstart',
      'volumechange', 'waiting', 'wheel']
    this.buttonTypes = ['button', 'submit', 'reset']
    this.labelElements = ['optgroup', 'option']
    // this.valueElements = ['data']
    this.translatableAttributes = ['alt', 'cite', 'href', 'label', 'placeholder', 'src', 'srcset', 'title', 'value']
    this.translations = {}
    this.titles = {}
  }
  async connectedCallback() {
    if (this.getAttribute('default')) {
      this.defaultLanguage = this.getAttribute('default')
    }
    const langParent = this.closest(`[${this.langAttribute}]`)
    if (langParent) {
      this.defaultLanguage = langParent.getAttribute(this.langAttribute)
    }
    this.previousLanguage = this.defaultLanguage
    this.currentLanguage = this.defaultLanguage
    this.translationFile = this.getAttribute('src')
    this.classList.add(this.classSelector)
    this.setAttribute('default', this.defaultLanguage)
    const params = new URLSearchParams(document.location.search)
    const newLanguage = params.get(this.langQueryParameter)
    if (newLanguage) {
      this.currentLanguage = newLanguage
    }
    if (this.translationFile) {
      try {
        const resp = await fetch(this.translationFile)
        if (resp.ok) {
          Object.assign(this.translations, await resp.json()) // merge
        }
        else {
          console.warn(`Failed to load translations from ${this.translationFile}: ${resp.status}`);
        }
        const translatables = document.querySelectorAll('[lang]')
        for (const elem of translatables) {
          this.translateElement(elem)
        }
        if (newLanguage && ! (newLanguage in this.languages)) {
          console.warn(`No translations for language ${newLanguage}, reverting to ${this.defaultLanguage}`)
          this.currentLanguage = this.defaultLanguage
        }
      }
      catch(e) {
        console.error(e)
        return false
      }
    }
    this.root.setAttribute(this.langAttribute, this.currentLanguage)
    
    const langSwitcher = document.createElement('ul')
    for (const lang in this.languages) {
      params.set(this.langQueryParameter, lang)
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.textContent = lang
      a.href = document.location.pathname + '?' + params.toString()
      a.hreflang = lang
      li.appendChild(a)
      if (lang == this.currentLanguage) {
        li.className = 'selected'
      }
      li.onclick = (e) => {
        e.preventDefault()
        try { // won't work with file:// URIs
          history.replaceState({lang}, '', a.href)
        } catch(e) { }
        const prev = this.querySelector('li.selected')
        prev.classList.remove('selected')
        li.classList.add('selected')
        this.setLanguage(lang)
      }
      langSwitcher.appendChild(li)
    }
    this.appendChild(langSwitcher)
    const style = document.createElement("style")
    style.textContent = `
*[${this.langAttribute}]:not([${this.langAttribute}="${this.currentLanguage}"]) {
 display: none !important;
}
`
    this.appendChild(style)
    for (const stylesheet of document.styleSheets) {
      try {
        for (let i = 0; i < stylesheet.cssRules.length; i++) {
          const rule = stylesheet.cssRules[i]
          if (rule.selectorText == `[${this.langAttribute}]:not([${this.langAttribute}="${this.currentLanguage}"])`) {
            this.cssRuleIndex = i
            this.css = stylesheet
            break
          }
        }
      } catch (e) {
        // skipping external stylesheets or those with CORS issues
      }
    }
    this.popstateHandler = (event) => {
      const lang = event.state?.currentLanguage
      if (lang) {
        this.setLanguage(lang)
      }
    }
    window.addEventListener("popstate", this.popstateHandler)
    const mutationConfig = { attributes: true, childList: true, subtree: true }
    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type == 'childList') {
          const addedNodes = mutation.addedNodes
          for (const node of addedNodes) {
            if (node.nodeType == 1 && node.hasAttribute(this.langAttribute) && node.getAttribute(this.langAttribute) == this.defaultLanguage) {
              this.translateElement(node)
            }
            else if (node.querySelectorAll) {
              const translatableChildren = node.querySelectorAll(`[${this.langAttribute}="${this.defaultLanguage}"]`) || []
              for (const child of translatableChildren) {
                this.translateElement(child)
              }
            }
          }
        }
        else if (mutation.type == 'attributes' && mutation.target.hasAttribute(this.langAttribute)) {
          // this.translateElement(mutation.target)
        }
      }
    })
    this.mutationObserver.observe(document.body, mutationConfig)
    this.loadHandler = (event) => {
      // this.setLanguage(this.currentLanguage)
    }
    window.addEventListener('load', this.loadHandler)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name == 'default') {
      this.defaultLanguage = newValue
    }
    else if (name == 'current') {
      this.currentLanguage = newValue
      this.setLanguage(newValue, true)
    }
  }

  translateElement(elem, parent=null) {
    this.languages[elem.getAttribute(this.langAttribute)] = true
    if (elem == this.root) {
      return false
    }
    if (elem.tagName.toLowerCase() == 'title') {
      this.titles[this.previousLanguage] = elem.textContent
    }
    if (!parent && elem.parentNode.tagName.toLowerCase() == 'optgroup' && elem.parentNode.hasAttribute(this.langAttribute)) {
      return false
    }
    let key = elem.textContent
    if (elem.tagName.toLowerCase() == 'input' && this.buttonTypes.includes(elem.type.toLowerCase())) {
      key = elem.value
    }
    if (this.labelElements.includes(elem.tagName.toLowerCase())) {
      key = elem.label || elem.textContent
    }
    let copies = {}
    if (this.translations[key] !== undefined) {
      for (const lang in this.translations[key]) {
        this.languages[lang] = true
        if (elem.tagName.toLowerCase() == 'title') {
          this.titles[lang] = this.translations[elem.textContent]?.[lang] || elem.textContent
        }
        if (elem.getAttribute(this.langAttribute) == lang) {
          continue
        }
        copies[lang] = this.deepCopy(elem, lang)
        if (elem.tagName.toLowerCase() == 'input' && this.buttonTypes.includes(elem.type.toLowerCase())) {
          copies[lang].value = this.translations[key][lang]
        }
        else if (this.labelElements.includes(elem.tagName.toLowerCase())) {
          copies[lang].label = this.translations[key][lang]
          if (elem.textContent && elem.children.length == 0) {
            copies[lang].textContent = this.translations[key][lang]
          }
        }
        else {
          copies[lang].innerHTML = this.translations[key][lang]
        }
        const translatableChildren = copies[lang].querySelectorAll(`[${this.langAttribute}="${this.defaultLanguage}"]`)
        for (const child of translatableChildren) {
          this.translateElement(child, copies[lang])
        }
      }
    }
    else {
      const translatableChildren = elem.querySelectorAll(`[${this.langAttribute}="${this.defaultLanguage}"]`)
      for (const child of translatableChildren) {
        this.translateElement(child, copies[lang])
      }
    }
    if (elem.tagName.toLowerCase() == 'title') {
      elem.textContent = this.titles[this.currentLanguage] || this.translations[elem.textContent]?.[this.currentLanguage] || elem.textContent
      this.titles[this.currentLanguage] = elem.textContent
    }
    for (const attr of this.translatableAttributes) {
      const attrKey = elem.getAttribute(attr)
      if (this.translations[attrKey] !== undefined) {
        // element's textContent is not in the translations but attributes might be
        for (const lang in this.translations[attrKey]) {
          this.languages[lang] = true
          copies[lang] = copies[lang] || this.deepCopy(elem, lang)
          copies[lang].setAttribute(attr, this.translations[attrKey][lang])
        }
      }
    }
    // see if translations already exist in the DOM
    let translated = elem.parentNode?.querySelector(`:scope > ${elem.tagName}[${this.langAttribute}]:not([${this.langAttribute}="${this.defaultLanguage}"])`)
    for (const lang in copies) {
      if (parent) {
        parent.replaceChild(copies[lang], elem)
      } else {
        elem.after(copies[lang])
      }
      translated = true
    }
    if (!translated) {
      if (key) console.warn('No translations for ', key)
      elem.removeAttribute(this.langAttribute) // not translated
    }
    return translated
  }

  setLanguage(lang, byDOM=false) {
    // console.log('setting new language', lang)
    if (! lang in this.languages) {
      console.warn(`No translations for language ${lang}, reverting to ${this.previousLanguage}`)
      this.currentLanguage = this.previousLanguage
      return
    }
    this.previousLanguage = this.currentLanguage
    this.currentLanguage = lang
    this.root.setAttribute(this.langAttribute, lang)
    const translatableTitle = document.querySelector(`title[${this.langAttribute}]`)
    if (translatableTitle) {
      translatableTitle.textContent = this.titles[this.currentLanguage] || translatableTitle.textContent
    }
    if (this.css && (this.cssRuleIndex >=0)) {
      this.css.deleteRule(this.cssRuleIndex)
      this.css.insertRule(`[${this.langAttribute}]:not([${this.langAttribute}="${lang}"]) { display: none !important; }`, this.cssRuleIndex)
    }
    const opts = document.querySelectorAll(`option[${this.langAttribute}]:checked`)
    for (const opt of opts) {
     opt.selected = false
     const otherOpt = opt.parentNode.parentNode.querySelector(`option[${this.langAttribute}="${lang}"][value="${opt.value}"]`)
     if (otherOpt) {
      otherOpt.selected = "selected"
     }
    }
    if (!byDOM) {
      this.setAttribute('current', lang)
    }
  }

  deepCopy(elem, lang) {
    const copy = elem.cloneNode(true)
    copy.setAttribute(this.langAttribute, lang)
    if (copy.id) {
      copy.id = `${copy.id}-${lang}`
      while (document.getElementById(copy.id)) {
        copy.id = `${copy.id}-${lang}-${self?.crypto?.randomUUID() || Math.floor(Math.random() * 1000)}`
      }
    }
    for (const listener of this.listeners) {
      // if (elem[`on${listener}`]) copy[`on${listener}`] = elem[`on${listener}`]
      if (elem.hasAttribute(listener)) {
        copy.setAttribute(listener, elem.getAttribute(listener))
      }
    }
    return copy
  }

  disconnectedCallback() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }
    if (this.popstateHandler) {
      window.removeEventListener("popstate", this.popstateHandler)
      this.popstateHandler = null
    }
    if (this.loadHandler) {
      window.removeEventListener('load', this.loadHandler)
      this.loadHandler = null
    }
    const languageItems = this.querySelectorAll('li')
    languageItems.forEach(item => {
      if (item.onclick) {
        item.onclick = null
      }
    })
    this.translations = {}
    this.languages = {}
    this.titles = {}
    this.css = null
    this.root = null

  }

}

customElements.define("translate-element", TranslateElement)