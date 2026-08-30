/**
 * `<translate-element>` translates the page it's placed on. Content can be translated
 * either by authoring per-language siblings marked with a `lang` attribute directly in
 * the HTML ("hand-authored" translations), or by supplying a JSON translation
 * dictionary via the `src` attribute (or both at once). A language switcher listing
 * every language found is rendered inside the element once translation has run.
 */
class TranslateElement extends HTMLElement {

  static observedAttributes = ["current", "default"];

  /**
   * Initializes per-instance state. Per the Custom Elements spec, DOM setup is deferred
   * to connectedCallback() - the constructor only prepares plain data.
   */
  constructor() {
    super();
    this.defaultLanguage = 'en'
    this.previousLanguage = this.defaultLanguage
    this.translationFile = null
    this.langAttribute = 'lang'
    this.componentClassName = 'translate-element'
    this.langQueryParameter = 'lang'
    this.currentLanguage = this.defaultLanguage
    this.rootElement = document.querySelector(':root')
    this.languages = {}
    // event names whose listener (property or attribute form) cloneNode() won't copy,
    // so cloneForLanguage() has to carry them over onto each translated clone itself
    this.eventListenerNames = [
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
    this.buttonInputTypes = ['button', 'submit', 'reset']
    this.labelTagNames = ['optgroup', 'option']
    // this.valueElements = ['data']
    this.translatableAttributes = ['alt', 'cite', 'href', 'label', 'placeholder', 'src', 'srcset', 'title', 'value']
    this.translations = {}
    this.titles = {}
    this.translationQueue = []
    // elements translateElement() has already run to completion for - re-observing one
    // (e.g. a DOM move re-triggering the MutationObserver) is then a no-op unless this
    // entry is explicitly cleared first, as the 'attributes' mutation handling below does
    this.processedElements = new WeakSet()
    // the clones translateElement() most recently produced for a given source element,
    // so a deliberate retranslation can remove the previous set before creating new ones
    this.elementClones = new WeakMap()
  }

  /**
   * Reads the `default`/`src` attributes, starts loading the translation dictionary (if
   * any) without blocking, and once both it and the window's `load` event are ready, runs
   * the initial translation pass and starts observing the DOM for further changes.
   */
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
    this.classList.add(this.componentClassName)
    this.setAttribute('default', this.defaultLanguage)
    this.searchParams = new URLSearchParams(document.location.search)
    const newLanguage = this.searchParams.get(this.langQueryParameter)
    if (newLanguage) {
      this.currentLanguage = newLanguage
    }
    // start the fetch but don't await it yet: awaiting here would delay registering the
    // window 'load' listener below, and on a fast-loading page 'load' can fire (and be
    // missed, since it only fires once) before this fetch resolves
    const translationsReady = this.translationFile
      ? fetch(this.translationFile).then(async (resp) => {
          if (resp.ok) {
            Object.assign(this.translations, await resp.json()) // merge
          }
          else {
            console.warn(`Failed to load translations from ${this.translationFile}: ${resp.status}`)
          }
        }).catch((e) => console.warn(e))
      : Promise.resolve()

    this.popstateHandler = (event) => {
      const lang = event.state?.lang
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
            if (node.nodeType != 1) {
              continue
            }
            // register every language found, even one that never reaches translateElement
            // (e.g. a hand-authored non-default-language variant added alongside its
            // source), so the switcher stays current with what's actually on the page
            const langTagged = node.hasAttribute(this.langAttribute) ? [node] : []
            if (node.querySelectorAll) {
              langTagged.push(...node.querySelectorAll(`[${this.langAttribute}]`))
            }
            for (const taggedElem of langTagged) {
              this.registerLanguage(taggedElem.getAttribute(this.langAttribute))
            }
            if (node.hasAttribute(this.langAttribute) && node.getAttribute(this.langAttribute) == this.defaultLanguage) {
              const elem = node
              try {
                this.translateElement(elem)
              }
              catch(e) {
                console.warn(`Error translating element: `, elem, e)
              }
            }
            else if (node.querySelectorAll) {
              const translatableChildren = node.querySelectorAll(`[${this.langAttribute}="${this.defaultLanguage}"]`) || []
              this.translationQueue = this.translationQueue.concat(Array.from(translatableChildren))
              while (this.translationQueue.length > 0) {
                const elem = this.translationQueue.pop()
                try {
                  this.translateElement(elem)
                }
                catch(e) {
                  console.warn(`Error translating element: `, elem, e)
                }
              }
            }
          }
        }
        else if (mutation.type == 'attributes' && mutation.target.hasAttribute(this.langAttribute)) {
          const elem = mutation.target
          // only a default-language source element's own translatable attributes are
          // worth reacting to - a clone's attributes are output, not input, and a change
          // to e.g. class/id/style has no bearing on what gets translated
          if (elem.getAttribute(this.langAttribute) == this.defaultLanguage && this.translatableAttributes.includes(mutation.attributeName)) {
            this.processedElements.delete(elem) // allow translateElement to run again
            try {
              this.translateElement(elem)
            }
            catch(e) {
              console.warn(`Error translating element: `, elem, e)
            }
          }
        }
      }
    })

    this.loadHandler = (event) => {
      const langMarked = Array.from(document.querySelectorAll(`[${this.langAttribute}]`))
      for (const elem of langMarked) {
        this.registerLanguage(elem.getAttribute(this.langAttribute))
      }
      // only default-language elements are source content to translate - a hand-authored
      // translation variant (lang="sv" etc.) is already-translated output, not input, and
      // running it through translateElement would just misfire the "no translation" check
      const translatable = langMarked.filter((elem) => elem.getAttribute(this.langAttribute) == this.defaultLanguage)
      this.translationQueue = this.translationQueue.concat(translatable)
      while (this.translationQueue.length > 0) {
        const elem = this.translationQueue.pop()
        try {
          this.translateElement(elem)
        }
        catch(e) {
          console.warn(`Error translating element: `, elem, e)
        }
      }
      if (newLanguage && ! (newLanguage in this.languages) && (newLanguage != this.defaultLanguage)) {
        console.warn(`No translations for language ${newLanguage}, reverting to ${this.defaultLanguage}`)
        this.currentLanguage = this.defaultLanguage
      }
      this.rootElement.setAttribute(this.langAttribute, this.currentLanguage)

      this.languageSwitcher = document.createElement('ul')
      for (const lang in this.languages) {
        this.addLanguageToSwitcher(lang)
      }
      this.appendChild(this.languageSwitcher)
      // content gets filled in by setLanguage() below, and again on every later switch
      this.visibilityStyleElement = document.createElement("style")
      this.appendChild(this.visibilityStyleElement)
      this.setLanguage(this.currentLanguage)
    }

    // the document may already have finished loading by the time translationsReady
    // resolves (or vice versa) - wait for whichever of the two is still pending,
    // rather than relying solely on the 'load' event firing after this point
    const windowLoaded = document.readyState == 'complete'
      ? Promise.resolve()
      : new Promise((resolve) => {
          this.windowLoadListener = resolve
          window.addEventListener('load', this.windowLoadListener, { once: true })
        })

    await Promise.all([translationsReady, windowLoaded])
    // only start observing once translations are loaded: elements parsed into the page
    // earlier are covered by loadHandler's own full-page scan below, and starting the
    // observer any sooner would let it race translateElement calls against an empty dict
    this.mutationObserver.observe(document.body, mutationConfig)
    this.loadHandler()
  }

  /**
   * Reacts to changes on the observed `default`/`current` attributes - `current` drives
   * setLanguage() so that setting the attribute externally (or via history navigation)
   * switches the displayed language.
   * @param {string} name
   * @param {string|null} oldValue
   * @param {string|null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name == 'default') {
      this.defaultLanguage = newValue
    }
    else if (name == 'current') {
      this.currentLanguage = newValue
      this.setLanguage(newValue, true)
    }
  }

  /**
   * Records that `lang` exists and, once the switcher has been built, keeps it in sync -
   * a language discovered after the initial load (e.g. a hand-authored variant or a dict
   * entry found while translating dynamically added content) gets its own switcher entry
   * instead of silently being tracked without ever appearing there.
   * @param {string} lang
   */
  registerLanguage(lang) {
    if (!lang || this.languages[lang]) {
      return
    }
    this.languages[lang] = true
    if (this.languageSwitcher) {
      this.addLanguageToSwitcher(lang)
    }
  }

  /**
   * Appends one `<li><a></a></li>` entry for `lang` to the language switcher, wired up
   * to switch the page to that language on click. Assumes `this.languageSwitcher` exists
   * and is a no-op if `lang` already has an entry.
   * @param {string} lang
   */
  addLanguageToSwitcher(lang) {
    if (this.languageSwitcher.querySelector(`a[hreflang="${lang}"]`)) {
      return
    }
    this.searchParams.set(this.langQueryParameter, lang)
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.textContent = lang
    a.href = document.location.pathname + '?' + this.searchParams.toString()
    a.hreflang = lang
    a.rel = 'alternate'
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
    this.languageSwitcher.appendChild(li)
  }

  /**
   * Translates a single default-language element: for each language with a matching
   * dictionary entry (by text content or a translatable attribute), inserts a translated
   * clone right after `elem`. If nothing matches, falls back to treating an already
   * hand-authored sibling as a translation, and otherwise strips `elem`'s `lang`
   * attribute so it always displays regardless of the selected language.
   *
   * Idempotent per element: repeat calls (e.g. from a DOM move re-triggering the
   * MutationObserver) are no-ops unless `processedElements` was explicitly cleared first
   * (see the 'attributes' mutation handling in connectedCallback()).
   * @param {Element} elem
   * @returns {boolean} whether a translation (dict-based or hand-authored) was found
   */
  translateElement(elem) {
    if (this.processedElements.has(elem)) {
      return false
    }
    this.processedElements.add(elem)
    const previousClones = this.elementClones.get(elem)
    if (previousClones) {
      for (const clone of previousClones) {
        clone.remove()
      }
    }
    this.registerLanguage(elem.getAttribute(this.langAttribute))
    // remove other instances in the array
    while (this.translationQueue.includes(elem)) {
      this.translationQueue.splice(this.translationQueue.indexOf(elem), 1)
    }
    if (elem == this.rootElement) {
      return false
    }
    if (elem.parentNode && elem.parentNode.tagName.toLowerCase() == 'optgroup' && elem.parentNode.hasAttribute(this.langAttribute)) {
      return false
    }
    // translate child elements first
    const translatableChildren = elem.querySelectorAll(`[${this.langAttribute}="${this.defaultLanguage}"]`)
    this.translationQueue = this.translationQueue.concat(Array.from(translatableChildren))
    while (this.translationQueue.length > 0) {
      const child = this.translationQueue.pop()
      try {
        this.translateElement(child)
      }
      catch(e) {
        console.warn(`Error translating element: `, child, e)
      }
    }
    if (elem.tagName.toLowerCase() == 'title') {
      this.titles[this.previousLanguage] = elem.textContent
    }
    let key = elem.textContent
    if (elem.tagName.toLowerCase() == 'input' && this.buttonInputTypes.includes(elem.type.toLowerCase())) {
      key = elem.value
    }
    if (this.labelTagNames.includes(elem.tagName.toLowerCase())) {
      key = elem.label || elem.textContent
    }
    key = key?.trim() || ''
    let copies = {}
    if (this.translations[key] !== undefined) {
      for (const lang in this.translations[key]) {
        this.registerLanguage(lang)
        if (elem.tagName.toLowerCase() == 'title') {
          this.titles[lang] = this.translations[elem.textContent]?.[lang] || elem.textContent
        }
        if (elem.getAttribute(this.langAttribute) == lang) {
          continue
        }
        copies[lang] = this.cloneForLanguage(elem, lang)
        if (elem.tagName.toLowerCase() == 'input' && this.buttonInputTypes.includes(elem.type.toLowerCase())) {
          copies[lang].value = this.translations[key][lang]
        }
        else if (this.labelTagNames.includes(elem.tagName.toLowerCase())) {
          copies[lang].label = this.translations[key][lang]
          if (elem.textContent && elem.children.length == 0) {
            copies[lang].textContent = this.translations[key][lang]
          }
        }
        else {
          copies[lang].innerHTML = this.translations[key][lang]
        }
        this.translateNestedOptions(copies[lang], lang)
      }
    }
    if (elem.tagName.toLowerCase() == 'title' && this.titles[this.currentLanguage]) {
      // elem.textContent = this.titles[this.currentLanguage] || this.translations[elem.textContent]?.[this.currentLanguage] || elem.textContent
      elem.textContent = this.titles[this.currentLanguage]
      this.titles[this.currentLanguage] = elem.textContent
      return true
    }
    for (const attr of this.translatableAttributes) {
      let attrKey = elem.getAttribute(attr)
      if (attrKey) {
        attrKey = attrKey.trim()
      }
      if (this.translations[attrKey] !== undefined) {
        // element's textContent is not in the translations but attritutes might be
        for (const lang in this.translations[attrKey]) {
          this.registerLanguage(lang)
          const isNewCopy = !copies[lang]
          copies[lang] = copies[lang] || this.cloneForLanguage(elem, lang)
          copies[lang].setAttribute(attr, this.translations[attrKey][lang])
          if (isNewCopy) {
            this.translateNestedOptions(copies[lang], lang)
          }
        }
      }
    }

    for (const lang in copies) {
      elem.after(copies[lang])
    }
    this.elementClones.set(elem, Object.values(copies))
    let translated = Object.keys(copies).length > 0
    if (!translated) {
      translated = this.hasHandAuthoredTranslation(elem)
    }
    if (!translated) {
      if (key) console.warn('No translations for ', key, ', ', elem)
      elem.removeAttribute(this.langAttribute) // not translated
    }
    return translated
  }

  /**
   * True if `elem` (which has no dict entry) already has a hand-authored translation
   * sitting right next to it (see README: siblings marked with `lang` instead of a
   * translations file). Authors can order these either way - the translation before or
   * after its source - so both directions are checked; the sibling's tag name must match
   * `elem`'s so an unrelated lang-tagged element elsewhere doesn't count as one.
   * @param {Element} elem
   * @returns {boolean}
   */
  hasHandAuthoredTranslation(elem) {
    const isTranslationSibling = (sibling) => !!(sibling && sibling.tagName == elem.tagName && sibling.hasAttribute(this.langAttribute))
    return isTranslationSibling(elem.nextElementSibling) || isTranslationSibling(elem.previousElementSibling)
  }

  /**
   * The CSS rule that hides every translated element except those in `lang`.
   * @param {string} lang
   * @returns {string}
   */
  visibilityRuleFor(lang) {
    return `[${this.langAttribute}]:not([${this.langAttribute}="${lang}"]) { display: none !important; }`
  }

  /**
   * Switches the currently displayed language: updates the root `lang` attribute, the
   * page title, the visibility stylesheet rule, and selected `<option>`s.
   * @param {string} lang
   * @param {boolean} [fromAttributeChange] set when called from attributeChangedCallback,
   *   to avoid writing the `current` attribute back and re-triggering that same callback
   */
  setLanguage(lang, fromAttributeChange=false) {
    if (! (lang in this.languages)) {
      console.warn(`No translations for language ${lang}, reverting to ${this.previousLanguage}`)
      this.currentLanguage = this.previousLanguage
      return
    }
    this.previousLanguage = this.currentLanguage
    this.currentLanguage = lang
    this.rootElement.setAttribute(this.langAttribute, lang)
    const translatableTitle = document.querySelector(`title[${this.langAttribute}]`)
    if (translatableTitle && this.titles[this.currentLanguage]) {
      translatableTitle.textContent = this.titles[this.currentLanguage]
      translatableTitle.lang = this.currentLanguage
    }
    if (this.visibilityStyleElement) {
      this.visibilityStyleElement.textContent = this.visibilityRuleFor(lang)
    }
    const opts = document.querySelectorAll(`option[${this.langAttribute}]:checked`)
    for (const opt of opts) {
     opt.selected = false
     const otherOpt = opt.closest('select').querySelector(`option[${this.langAttribute}="${lang}"][value="${opt.value}"]`)
     if (otherOpt) {
      otherOpt.selected = "selected"
     }
     else {
      console.warn(`No matching option for ${opt.value} in language ${lang}`)
     }
    }
    if (!fromAttributeChange) {
      this.setAttribute('current', lang)
    }
  }

  /**
   * cloneForLanguage() only retags the element it's given, not its descendants. A nested
   * `<option>` inside an `<optgroup>` is deliberately skipped by the optgroup guard in
   * translateElement() (translating it independently would create stray per-language
   * `<option>` siblings inside the still-untranslated `<optgroup>`) - so once the
   * optgroup itself has been cloned for a language, this fills in the translation the
   * guard deferred, directly on the clone's own copy of that descendant.
   * @param {Element} clone
   * @param {string} lang
   */
  translateNestedOptions(clone, lang) {
    const nestedOptions = clone.querySelectorAll(`[${this.langAttribute}="${this.defaultLanguage}"]`)
    for (const option of nestedOptions) {
      const optionParent = option.parentNode
      if (!(optionParent && optionParent.tagName.toLowerCase() == 'optgroup' && optionParent.hasAttribute(this.langAttribute))) {
        continue
      }
      let key = option.textContent
      if (this.labelTagNames.includes(option.tagName.toLowerCase())) {
        key = option.label || option.textContent
      }
      key = key?.trim() || ''
      const translation = this.translations[key]?.[lang]
      if (translation !== undefined) {
        if (this.labelTagNames.includes(option.tagName.toLowerCase())) {
          option.label = translation
          if (option.textContent && option.children.length == 0) {
            option.textContent = translation
          }
        }
        else {
          option.innerHTML = translation
        }
      }
      for (const attr of this.translatableAttributes) {
        let attrKey = option.getAttribute(attr)
        if (attrKey) {
          attrKey = attrKey.trim()
        }
        const attrTranslation = this.translations[attrKey]?.[lang]
        if (attrTranslation !== undefined) {
          option.setAttribute(attr, attrTranslation)
        }
      }
      option.setAttribute(this.langAttribute, lang)
    }
  }

  /**
   * Gives an id a unique, lang-specific replacement so a clone (or a descendant of one)
   * never shares an id with the element it was copied from, or with another clone.
   * @param {Element} elem
   * @param {string} lang
   */
  uniquifyId(elem, lang) {
    if (!elem.id) {
      return
    }
    elem.id = `${elem.id}-${lang}`
    while (document.getElementById(elem.id)) {
      elem.id = `${elem.id}-${lang}-${self?.crypto?.randomUUID() || Math.floor(Math.random() * 1000)}`
    }
  }

  /**
   * Clones `elem` for `lang`: tags the clone with the language, gives it (and any
   * descendant with an id) a unique id, and carries over listener functions/attributes
   * that cloneNode() doesn't copy.
   * @param {Element} elem
   * @param {string} lang
   * @returns {Element} the untranslated clone, ready for translateElement() to fill in
   */
  cloneForLanguage(elem, lang) {
    const copy = elem.cloneNode(true)
    copy.setAttribute(this.langAttribute, lang)
    this.uniquifyId(copy, lang)
    for (const descendant of copy.querySelectorAll('[id]')) {
      this.uniquifyId(descendant, lang)
    }
    for (const listener of this.eventListenerNames) {
      if (elem[`on${listener}`]) {
        copy[`on${listener}`] = elem[`on${listener}`]
      }
      if (elem.hasAttribute(listener)) {
        copy.setAttribute(listener, elem.getAttribute(listener))
      }
    }
    return copy
  }

  /**
   * Tears down every listener and observer registered in connectedCallback(), and clears
   * per-instance state so nothing keeps the element (or its clones) alive after removal.
   */
  disconnectedCallback() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
      this.mutationObserver = null
    }
    if (this.popstateHandler) {
      window.removeEventListener("popstate", this.popstateHandler)
      this.popstateHandler = null
    }
    if (this.windowLoadListener) {
      window.removeEventListener('load', this.windowLoadListener)
      this.windowLoadListener = null
    }
    this.loadHandler = null
    const languageItems = this.querySelectorAll('li')
    languageItems.forEach(item => {
      if (item.onclick) {
        item.onclick = null
      }
    })
    this.translationQueue = null
    this.translations = null
    this.languages = null
    this.titles = null
    this.visibilityStyleElement = null
    this.rootElement = null
    this.processedElements = null
    this.elementClones = null
    this.languageSwitcher = null
    this.searchParams = null

  }

}

customElements.define("translate-element", TranslateElement)
