const { test, expect } = require('@playwright/test')

test.describe('static HTML + translations.json + hand-authored siblings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test/fixtures/static-mixed.html')
    await page.locator('translate-element ul').waitFor()
  })

  test('a hand-authored sibling wins over the dict entry for its language', async ({ page }) => {
    // "Welcome" is a dict key with sv/de/fr - the hand-authored sv must not get a second sv copy
    await expect(page.locator('h1[lang="sv"]')).toHaveCount(1)
    await expect(page.locator('h1[lang="sv"]')).toHaveText('Välkommen hit')
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('h1:visible')).toHaveCount(1)
    await expect(page.locator('#heading-sv')).toBeVisible()
  })

  test('the dict still adds the languages the hand-authored siblings lack', async ({ page }) => {
    await expect(page.locator('h1[lang="de"]')).toHaveText('Willkommen')
    await expect(page.locator('h1[lang="fr"]')).toHaveText('Bienvenue')
    await expect(page.locator('#heading')).toHaveAttribute('lang', 'en')
  })

  test('a hand-authored sibling that precedes its source also wins', async ({ page }) => {
    await expect(page.locator('h2[lang="de"]')).toHaveCount(1)
    await expect(page.locator('h2[lang="de"]')).toHaveText('Abbruch')
    await expect(page.locator('h2[lang="sv"]')).toHaveText('Avbryt')
  })

  test('a hand-authored sibling wins over a dict entry for an attribute', async ({ page }) => {
    await expect(page.locator('input[lang="sv"]')).toHaveCount(1)
    await expect(page.locator('input[lang="sv"]')).toHaveAttribute('placeholder', 'Ditt namn')
    await expect(page.locator('input[lang="de"]')).toHaveAttribute('placeholder', 'Geben Sie Ihren Namen ein')
  })

  test('another source element and its clones are not mistaken for hand-authored siblings', async ({ page }) => {
    // #hello and #submit are adjacent dict-translated <p>s: each gets its own sv/de copies
    await expect(page.locator('p[lang="sv"]')).toHaveText(['Hej där', 'Skicka'])
    await expect(page.locator('p[lang="de"]')).toHaveText(['Hallo da', 'Senden'])
  })

  test('adjacent untranslated default-language elements are not each other\'s translations', async ({ page }) => {
    expect(await page.locator('#untranslated-a').getAttribute('lang')).toBeNull()
    expect(await page.locator('#untranslated-b').getAttribute('lang')).toBeNull()
    await page.locator('translate-element ul li a[hreflang="sv"]').click()
    await expect(page.locator('#untranslated-a')).toBeVisible()
    await expect(page.locator('#untranslated-b')).toBeVisible()
  })
})
