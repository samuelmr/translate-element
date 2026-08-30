const { test, expect } = require('@playwright/test')

test.describe('dynamically added DOM + hand-authored translations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/dynamic-hand-authored.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('regression: a hand-authored variant present at load is never warned about or stripped', async ({ page }) => {
    // heading-sv is the *last* element in the page - it used to be the one case the
    // old (forward-sibling-only) "already translated" check couldn't detect, because
    // translateElement ran on every [lang] element, not just default-language ones
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })
    await page.reload()
    await page.locator('translate-element ul').waitFor()

    await expect(page.locator('#heading-sv')).toHaveAttribute('lang', 'sv')
    expect(warnings.some((w) => w.includes('Välkommen'))).toBe(false)
  })

  test('keeps the lang attribute when a hand-authored sibling is added alongside it', async ({ page }) => {
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })

    await page.locator('#add-pair').click()

    await expect(page.locator('#dyn-para-fr')).toHaveText('Paragraphe dynamique')
    // give the observer time to process #dyn-para-en before asserting its attribute survived
    await page.waitForTimeout(100)
    await expect(page.locator('#dyn-para-en')).toHaveAttribute('lang', 'en')
    expect(warnings.some((w) => w.includes('Dynamic paragraph'))).toBe(false)
  })

  test('regression: adds a new language to the switcher when a hand-authored variant arrives dynamically', async ({ page }) => {
    // fr is never run through translateElement (only default-language elements are),
    // so registering it for the switcher has to happen independently of translation
    await expect(page.locator('translate-element ul li a')).toHaveCount(2)
    await expect(page.locator('translate-element ul li a[hreflang="fr"]')).toHaveCount(0)

    await page.locator('#add-pair').click()

    await expect(page.locator('translate-element ul li a[hreflang="fr"]')).toHaveCount(1)
    await expect(page.locator('translate-element ul li a')).toHaveCount(3)

    // and the new entry actually works
    await page.locator('translate-element ul li a[hreflang="fr"]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page.locator('#dyn-para-fr')).toBeVisible()
    await expect(page.locator('#dyn-para-en')).toBeHidden()
  })

  test('strips the attribute and warns for a dynamically added element with no counterpart', async ({ page }) => {
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })

    await page.locator('#add-orphan').click()

    await expect.poll(() => page.locator('#dyn-orphan').getAttribute('lang')).toBeNull()
    await expect.poll(() => warnings.some((w) => w.includes('Nobody translated this either'))).toBe(true)
  })

  test('regression: re-observing a hand-authored element does not create duplicate siblings', async ({ page }) => {
    await page.locator('#add-pair').click()
    await expect(page.locator('#dyn-para-fr')).toHaveCount(1)

    await page.locator('#reattach-pair-en').click()

    await page.waitForTimeout(100)
    await expect(page.locator('#dyn-para-en')).toHaveCount(1)
    await expect(page.locator('#dyn-para-fr')).toHaveCount(1)
    await expect(page.locator('#dyn-para-en')).toHaveAttribute('lang', 'en')
  })
})
