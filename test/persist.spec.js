const { test, expect } = require('@playwright/test')

const KEY = 'translate-element:lang'

async function open(page, url) {
  await page.goto(url)
  await page.locator('translate-element ul').waitFor()
}

const visibleHeading = (page) => page.locator('h1:visible')

test.describe('persist attribute', () => {
  test('remembers the language chosen with the switcher on another page', async ({ page }) => {
    await open(page, '/test/fixtures/persist.html')
    await expect(visibleHeading(page)).toHaveText('Welcome')
    await page.locator('translate-element a[hreflang="sv"]').click()
    await expect(visibleHeading(page)).toHaveText('Välkommen')
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('sv')

    await page.locator('#other').click()
    await page.locator('translate-element ul').waitFor()
    await expect(page).toHaveURL(/persist-other\.html$/)
    await expect(visibleHeading(page)).toHaveText('Välkommen')
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv')
    await expect(page.locator('translate-element li.selected')).toHaveText('sv')
  })

  test('?lang= wins over the stored choice and does not overwrite it', async ({ page }) => {
    await open(page, '/test/fixtures/persist.html')
    await page.evaluate((k) => localStorage.setItem(k, 'sv'), KEY)
    await open(page, '/test/fixtures/persist.html?lang=de')
    await expect(visibleHeading(page)).toHaveText('Willkommen')
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('sv')
  })

  test('an unknown ?lang= falls back to the stored choice, then the page language', async ({ page }) => {
    await open(page, '/test/fixtures/persist.html')
    await page.evaluate((k) => localStorage.setItem(k, 'de'), KEY)
    await open(page, '/test/fixtures/persist.html?lang=xx')
    await expect(visibleHeading(page)).toHaveText('Willkommen')
    await page.evaluate((k) => localStorage.removeItem(k), KEY)
    await open(page, '/test/fixtures/persist.html?lang=xx')
    await expect(visibleHeading(page)).toHaveText('Welcome')
  })

  test('ignores a stored language the page does not have', async ({ page }) => {
    await open(page, '/test/fixtures/persist.html')
    await page.evaluate((k) => localStorage.setItem(k, 'xx'), KEY)
    await open(page, '/test/fixtures/persist.html')
    await expect(visibleHeading(page)).toHaveText('Welcome')
  })

  test('works when localStorage throws', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied') } })
    })
    await open(page, '/test/fixtures/persist.html')
    await page.locator('translate-element a[hreflang="sv"]').click()
    await expect(visibleHeading(page)).toHaveText('Välkommen')
  })

  test('without the attribute nothing is stored or read', async ({ page }) => {
    await open(page, '/test/fixtures/static-hand-authored.html')
    await page.evaluate((k) => localStorage.setItem(k, 'sv'), KEY)
    await open(page, '/test/fixtures/static-hand-authored.html')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.locator('translate-element a[hreflang="de"]').click()
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('sv')
  })
})

test.describe('prefer-browser-language attribute', () => {
  test.describe('browser prefers Swedish', () => {
    test.use({ locale: 'sv-SE' })
    test('uses the browser language when nothing else is chosen', async ({ page }) => {
      await open(page, '/test/fixtures/prefer-browser.html')
      await expect(visibleHeading(page)).toHaveText('Välkommen')
    })
    test('the stored choice wins over the browser language', async ({ page }) => {
      await open(page, '/test/fixtures/prefer-browser.html')
      await page.evaluate((k) => localStorage.setItem(k, 'de'), KEY)
      await open(page, '/test/fixtures/prefer-browser.html')
      await expect(visibleHeading(page)).toHaveText('Willkommen')
    })
    test('?lang= wins over the browser language', async ({ page }) => {
      await open(page, '/test/fixtures/prefer-browser.html?lang=en')
      await expect(visibleHeading(page)).toHaveText('Welcome')
    })
  })

  test.describe('browser prefers a language the page lacks', () => {
    test.use({ locale: 'fi-FI' })
    test('falls back to the page language', async ({ page }) => {
      await open(page, '/test/fixtures/prefer-browser.html')
      await expect(visibleHeading(page)).toHaveText('Welcome')
    })
  })

  test.describe('without the attribute', () => {
    test.use({ locale: 'sv-SE' })
    test('the browser language is ignored', async ({ page }) => {
      await open(page, '/test/fixtures/persist.html')
      await expect(visibleHeading(page)).toHaveText('Welcome')
    })
  })
})

test.describe('languagechange event', () => {
  test('fires once per switch with the new and previous language, and bubbles', async ({ page }) => {
    await page.addInitScript(() => {
      window.changes = []
      document.addEventListener('languagechange', (e) => window.changes.push(e.detail))
    })
    await open(page, '/test/fixtures/persist.html')
    await page.evaluate(() => { window.changes.length = 0 })
    await page.locator('translate-element a[hreflang="de"]').click()
    await expect(visibleHeading(page)).toHaveText('Willkommen')
    expect(await page.evaluate(() => window.changes)).toEqual([{ language: 'de', previousLanguage: 'en' }])
  })

  test('fires when the current attribute is set from outside', async ({ page }) => {
    await open(page, '/test/fixtures/persist.html')
    await page.evaluate(() => {
      window.changes = []
      document.addEventListener('languagechange', (e) => window.changes.push(e.detail.language))
      document.querySelector('translate-element').setAttribute('current', 'sv')
    })
    await expect(visibleHeading(page)).toHaveText('Välkommen')
    expect(await page.evaluate(() => window.changes)).toEqual(['sv'])
  })

  test('<html lang> still tracks the language (MutationObserver users)', async ({ page }) => {
    await open(page, '/test/fixtures/persist.html')
    const seen = await page.evaluate(() => new Promise((resolve) => {
      new MutationObserver(() => resolve(document.documentElement.lang))
        .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
      document.querySelector('translate-element a[hreflang="de"]').click()
    }))
    expect(seen).toBe('de')
  })
})
