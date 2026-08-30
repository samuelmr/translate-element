const { test, expect } = require('@playwright/test')

test.describe('static HTML + hand-authored (embedded) translations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/static-hand-authored.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('keeps the lang attribute on an element that has hand-authored siblings', async ({ page }) => {
    await expect(page.locator('#heading-en')).toHaveAttribute('lang', 'en')
    await expect(page.locator('#heading-sv')).toHaveText('Välkommen')
    await expect(page.locator('#heading-de')).toHaveText('Willkommen')
  })

  test('does not warn or strip the attribute for a hand-authored element with no dict entry', async ({ page }) => {
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    await page.reload()
    await page.locator('translate-element ul').waitFor()
    expect(warnings.some((w) => w.includes('Welcome') || w.includes('Hello there'))).toBe(false)
  })

  test('strips the lang attribute and warns for an element with no translation at all', async ({ page }) => {
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    await page.reload()
    await page.locator('translate-element ul').waitFor()
    expect(await page.locator('#orphan').getAttribute('lang')).toBeNull()
    expect(warnings.some((w) => w.includes('Nobody translated me'))).toBe(true)
  })

  test('regression: detects a hand-authored translation that precedes its source in the DOM', async ({ page }) => {
    // #submitFi (fi) sits *before* #submit (en) - the old check only ever looked at
    // nextElementSibling, so a translation authored before its source was invisible to it
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    await page.reload()
    await page.locator('translate-element ul').waitFor()

    await expect(page.locator('#submit')).toHaveAttribute('lang', 'en')
    await expect(page.locator('#submitFi')).toHaveAttribute('lang', 'fi')
    expect(warnings.some((w) => w.includes('Get'))).toBe(false)

    // and the pair actually works when switching language
    await page.locator('translate-element ul li a[hreflang="fi"]').click()
    await expect(page.locator('#submitFi')).toBeVisible()
    await expect(page.locator('#submit')).toBeHidden()
  })

  test('builds a language switcher for every language found across hand-authored siblings', async ({ page }) => {
    await expect(page.locator('translate-element ul li a')).toHaveCount(5)
    for (const lang of ['en', 'sv', 'de', 'fr', 'fi']) {
      await expect(page.locator(`translate-element ul li a[hreflang="${lang}"]`)).toHaveCount(1)
    }
  })

  test('an element with no variant for the selected language is hidden entirely', async ({ page }) => {
    // <p> only has en/fr variants - switching to "de" leaves neither visible
    await page.locator('translate-element ul li a[hreflang="de"]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.locator('#heading-de')).toBeVisible()
    await expect(page.locator('#para-en')).toBeHidden()
    await expect(page.locator('#para-fr')).toBeHidden()
  })
})
