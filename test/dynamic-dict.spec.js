const { test, expect } = require('@playwright/test')

test.describe('dynamically added DOM + translations.json', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/dynamic-dict.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('translates a single element added after load', async ({ page }) => {
    await page.locator('#add-single').click()

    await expect(page.locator('h2[lang="sv"]')).toHaveText('Dynamisk hälsning')
    await expect(page.locator('h2[lang="de"]')).toHaveText('Dynamische Begrüßung')
  })

  test('regression: adds a new language to the switcher when a dict entry introduces it dynamically', async ({ page }) => {
    // "no" only appears in the "Dynamic greeting" dict entry, used solely by #add-single,
    // so it can't already be in the switcher from the page's static content
    await expect(page.locator('translate-element ul li a[hreflang="no"]')).toHaveCount(0)

    await page.locator('#add-single').click()

    await expect(page.locator('translate-element ul li a[hreflang="no"]')).toHaveCount(1)
    await expect(page.locator('h2[lang="no"]')).toHaveText('Dynamisk hilsen')

    await page.locator('translate-element ul li a[hreflang="no"]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'no')
    await expect(page.locator('h2[lang="no"]')).toBeVisible()
  })

  test('translates every descendant of a batch-inserted wrapper', async ({ page }) => {
    await page.locator('#add-wrapper').click()

    await expect(page.locator('#dyn-wrapper h3[lang="sv"]')).toHaveText('Välkommen')
    await expect(page.locator('#dyn-wrapper h3[lang="de"]')).toHaveText('Willkommen')
    await expect(page.locator('#dyn-wrapper h4[lang="sv"]')).toHaveText('Skicka')
    await expect(page.locator('#dyn-wrapper h4[lang="de"]')).toHaveText('Senden')
  })

  test('strips the attribute and warns for a dynamically added element with no translation', async ({ page }) => {
    const warnings = []
    page.on('console', (msg) => {
      if (msg.type() === 'warning') warnings.push(msg.text())
    })

    await page.locator('#add-untranslated').click()

    await expect.poll(() => page.locator('#dyn-untranslated').getAttribute('lang')).toBeNull()
    await expect.poll(() => warnings.some((w) => w.includes('Nobody has this'))).toBe(true)
  })

  test('re-translates when a translatable attribute changes on an already-translated element', async ({ page }) => {
    await expect(page.locator('input[type="submit"][lang="sv"]')).toHaveValue('Skicka')
    await expect(page.locator('input[type="submit"][lang="de"]')).toHaveValue('Senden')

    // toggling the radio mutates #submit-button's "value" attribute via setAttribute,
    // which the MutationObserver's 'attributes' branch should pick up and re-translate
    await page.locator('input[name="action"][value="Cancel"]').check()

    await expect(page.locator('input[type="submit"][lang="sv"]')).toHaveValue('Avbryt')
    await expect(page.locator('input[type="submit"][lang="de"]')).toHaveValue('Abbrechen')
    // the stale "Skicka"/"Senden" clones must be gone, not just superseded
    await expect(page.locator('input[type="submit"][lang="sv"]')).toHaveCount(1)
    await expect(page.locator('input[type="submit"][lang="de"]')).toHaveCount(1)
  })

  test('regression: re-observing an already-translated element does not duplicate its clones', async ({ page }) => {
    await page.locator('#add-single').click()
    await expect(page.locator('h2[lang="sv"]')).toHaveCount(1)
    await expect(page.locator('h2[lang="de"]')).toHaveCount(1)

    // simulate app code moving the already-translated element around the DOM,
    // which re-triggers the MutationObserver's childList "added" branch for it
    await page.locator('#reattach-single').click()

    // give the MutationObserver a chance to (mis)fire before asserting the final count
    await page.waitForTimeout(100)
    await expect(page.locator('h2[lang="sv"]')).toHaveCount(1)
    await expect(page.locator('h2[lang="de"]')).toHaveCount(1)
  })
})
